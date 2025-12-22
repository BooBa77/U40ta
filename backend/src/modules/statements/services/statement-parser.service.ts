import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class StatementParserService {
  constructor(
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,
    
    @InjectRepository(ProcessedStatement)
    private processedStatementRepo: Repository<ProcessedStatement>,
    
    @InjectEntityManager()
    private entityManager: EntityManager,
    
    private appEventsService: AppEventsService,
  ) {}

  /**
   * Публичный метод: возвращает существующие записи ведомости
   * Используется когда ведомость уже в работе (in_process = true)
   */
  async getExistingStatements(attachmentId: number): Promise<ProcessedStatement[]> {
    return await this.processedStatementRepo.find({
      where: { emailAttachmentId: attachmentId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Публичный метод: основной парсинг ведомости
   * Создает записи в processed_statements
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatement[]> {
    console.log(`StatementParserService: парсинг ведомости ID: ${attachmentId}`);
    
    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
    });
    
    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }
    
    // 2. Пропускаем инвентаризацию
    if (attachment.is_inventory) {
      console.log(`StatementParserService: пропускаем инвентаризацию (ID: ${attachmentId})`);
      return [];
    }
    
    // 3. Если ведомость уже в работе - возвращаем существующие записи
    if (attachment.in_process) {
      console.log(`StatementParserService: ведомость уже в работе`);
      return await this.getExistingStatements(attachmentId);
    }
    
    // 4. Проверяем наличие файла
    const filePath = this.getFilePath(attachment.filename);
    if (!fs.existsSync(filePath)) {
      throw new InternalServerErrorException(`Файл не найден: ${attachment.filename}`);
    }
    
    // 5. Проверяем обязательные поля
    if (!attachment.sklad || !attachment.doc_type) {
      throw new InternalServerErrorException(
        `У вложения отсутствует склад (${attachment.sklad}) или тип документа (${attachment.doc_type})`,
      );
    }
    
    // 6. Транзакция (все операции атомарно)
    let savedStatements: ProcessedStatement[] = [];
    
    try {
      savedStatements = await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          
          // 6.1. Находим старую активную ведомость
          const oldStatement = await transactionalEntityManager.findOne(
            ProcessedStatement,
            {
              where: { 
                sklad: attachment.sklad || '',
                doc_type: attachment.doc_type || '',
              },
              select: ['emailAttachmentId'],
            },
          );
          
          const oldAttachmentId = oldStatement?.emailAttachmentId;
          console.log(`StatementParserService: найдена старая ведомость ID: ${oldAttachmentId || 'нет'}`);
          
          // 6.2. Удаляем старые записи этого склада/типа
          await transactionalEntityManager.delete(ProcessedStatement, {
            sklad: attachment.sklad,
            doc_type: attachment.doc_type,
          });
          console.log(`StatementParserService: удалены старые записи склада ${attachment.sklad}, тип ${attachment.doc_type}`);
          
          // 6.3. Сбрасываем флаг у старой ведомости
          if (oldAttachmentId && oldAttachmentId !== attachmentId) {
            await transactionalEntityManager.update(
              EmailAttachment,
              { id: oldAttachmentId },
              { in_process: false },
            );
            console.log(`StatementParserService: сброшен флаг in_process у ведомости ID: ${oldAttachmentId}`);
          }
          
          // 6.4. Парсим Excel
          const excelRows = this.parseExcel(filePath);
          const newStatements = this.createStatementsFromExcel(excelRows, attachment);
          
          // 6.5. Сохраняем новые записи
          const createdStatements = await transactionalEntityManager.save(
            ProcessedStatement,
            newStatements,
          );
          console.log(`StatementParserService: сохранено записей: ${createdStatements.length}`);
          
          // 6.6. Устанавливаем флаг у текущей ведомости
          await transactionalEntityManager.update(
            EmailAttachment,
            { id: attachmentId },
            { in_process: true },
          );
          console.log(`StatementParserService: установлен флаг in_process у ведомости ID: ${attachmentId}`);
          
          return createdStatements;
        },
      );
      
      // 7. Отправляем SSE уведомление
      this.appEventsService.notifyEmailAttachmentsUpdated();
      console.log('StatementParserService: отправлено SSE уведомление');
      
      return savedStatements;
      
    } catch (error) {
      console.error('StatementParserService: ошибка в транзакции:', error);
      throw new InternalServerErrorException(
        `Ошибка обработки ведомости: ${error.message}`,
      );
    }
  }

  /**
   * Приватный метод: формирует полный путь к файлу
   */
  private getFilePath(filename: string): string {
    const projectRoot = process.cwd();
    const emailAttachmentsDir = path.join(projectRoot, '..', 'email-attachments');
    const filePath = path.join(emailAttachmentsDir, filename);
    return filePath;
  }

  /**
   * Приватный метод: читает и парсит Excel файл
   */
  private parseExcel(filePath: string): any[] {
    console.log(`StatementParserService: чтение Excel файла: ${filePath}`);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`StatementParserService: прочитано строк: ${data.length}`);
      return data;
      
    } catch (error) {
      console.error('StatementParserService: ошибка чтения Excel:', error);
      throw new InternalServerErrorException(`Ошибка чтения Excel файла: ${error.message}`);
    }
  }

  /**
   * Приватный метод: создает объекты из данных Excel
   */
  private createStatementsFromExcel(
    excelRows: any[], 
    attachment: EmailAttachment,
  ): ProcessedStatement[] {
    const statements: ProcessedStatement[] = [];
    
    for (const row of excelRows) {
      const zavod = row['Завод'] ? parseInt(row['Завод']) : null;
      const sklad = row['Склад']?.toString() || attachment.sklad || '';
      const buhName = row['КрТекстМатериала']?.toString() || row['Материал']?.toString() || '';
      const invNumber = row['Материал']?.toString() || '';
      const partyNumber = row['Партия']?.toString() || '';

      // Пропускаем строки без номера материала (итоговые строки)
      if (!invNumber || invNumber.trim() === '') {
        console.log(`StatementParserService: пропущена сводная строка: "${buhName.substring(0, 50)}..."`);
        continue;
      }
      
      // Парсим количество
      let quantity = 1;
      const quantityValue = row['Запас на конец периода'];
      if (quantityValue !== undefined && quantityValue !== null) {
        const num = Number(quantityValue);
        if (!isNaN(num) && num > 0) {
          quantity = Math.floor(num);
        }
      }
      
      // Создаем N записей по количеству
      for (let i = 0; i < quantity; i++) {
        const statement = new ProcessedStatement();
        statement.emailAttachmentId = attachment.id;
        statement.sklad = sklad;
        statement.doc_type = attachment.doc_type || 'ОСВ';
        statement.zavod = zavod || 0;
        statement.buh_name = buhName;
        statement.inv_number = invNumber;
        statement.party_number = partyNumber;
        statement.have_object = false;
        statement.is_ignore = false;
        
        statements.push(statement);
      }
    }
    
    console.log(`StatementParserService: создано объектов: ${statements.length}`);
    return statements;
  }
}