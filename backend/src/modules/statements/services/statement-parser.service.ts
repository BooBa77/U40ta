import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
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
   * Формирует полный путь к файлу вложения
   */
    private getFilePath(filename: string): string {
      const projectRoot = process.cwd(); // Текущая директория (backend/)
      const emailAttachmentsDir = path.join(projectRoot, '..', 'email-attachments');
      const filePath = path.join(emailAttachmentsDir, filename);
      
      return filePath;
    }
    /**
     * Читает и парсит Excel файл
     */
    private parseExcel(filePath: string): any[] {
      console.log(`Чтение Excel файла: ${filePath}`);
      
      try {
        const workbook = XLSX.readFile(filePath);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`Прочитано строк: ${data.length}`);
        return data;
        
      } catch (error) {
        console.error('Ошибка чтения Excel:', error);
        throw new InternalServerErrorException(`Ошибка чтения Excel файла: ${error.message}`);
      }
    }
    /**
     * Создает объекты ProcessedStatement из данных Excel
     */
    private createStatementsFromExcel(
      excelRows: any[], 
      attachment: EmailAttachment
    ): ProcessedStatement[] {
      const statements: ProcessedStatement[] = [];
      
      for (const row of excelRows) {
        // Извлекаем данные из строки
        const zavod = row['Завод']?.toString() || '';
        const sklad = row['Склад']?.toString() || attachment.sklad || '';
        const buhName = row['КрТекстМатериала']?.toString() || row['Материал']?.toString() || '';
        const invNumber = row['Материал']?.toString() || '';
        const partyNumber = row['Партия']?.toString() || '';


        // ========== ФИЛЬТРАЦИЯ СВОДНЫХ СТРОК ==========
        // Пропускаем строки без номера материала (итоговые строки)
        if (!invNumber || invNumber.trim() === '') {
            console.log(`Пропущена сводная строка: "${buhName.substring(0, 50)}..."`);
            continue;
        }
        // ========== КОНЕЦ ФИЛЬТРАЦИИ ==========        

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
          statement.zavod = zavod;
          statement.buh_name = buhName;
          statement.inv_number = invNumber;
          statement.party_number = partyNumber;
          statement.have_object = false;
          statement.is_ignore = false;
          
          statements.push(statement);
        }
      }
      
      console.log(`Создано объектов: ${statements.length}`);
      return statements;
    }
    /**
     * Основной метод: открывает/распаривает ведомость
     */
    async parseStatement(attachmentId: number): Promise<ProcessedStatement[]> {
      console.log(`🔄 Запрос на открытие ведомости ID: ${attachmentId}`);
      
      // 1. Находим вложение
      const attachment = await this.emailAttachmentRepo.findOne({
        where: { id: attachmentId }
      });
      
      if (!attachment) {
        throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
      }
      
      // 2. Пропускаем инвентаризацию (пока не обрабатываем)
      if (attachment.is_inventory) {
        console.log(`⏭️ Пропускаем инвентаризацию (ID: ${attachmentId})`);
        return [];
      }
      
      // 3. Если ведомость уже в работе - возвращаем существующие записи
      if (attachment.in_process) {
        console.log(`📄 Ведомость уже в работе, возвращаем существующие записи`);
        return await this.processedStatementRepo.find({
          where: { emailAttachmentId: attachmentId },
          order: { id: 'ASC' }
        });
      }
      
      // 4. Проверяем наличие файла перед транзакцией
      const filePath = this.getFilePath(attachment.filename);
      if (!fs.existsSync(filePath)) {
        throw new InternalServerErrorException(`Файл не найден: ${attachment.filename}`);
      }
      
      // 5. Проверяем обязательные поля
      if (!attachment.sklad || !attachment.doc_type) {
        throw new InternalServerErrorException(
          `У вложения отсутствует склад (${attachment.sklad}) или тип документа (${attachment.doc_type})`
        );
      }
      
      // 6. ТРАНЗАКЦИЯ (все операции атомарно)
      let savedStatements: ProcessedStatement[] = [];
      
      try {
        savedStatements = await this.entityManager.transaction(
          async (transactionalEntityManager) => {
            
            // 6.1. Находим старую активную ведомость
            const oldStatement = await transactionalEntityManager.findOne(
              ProcessedStatement,
              {
                where: { 
                  sklad: attachment.sklad!,   // Используем ! потому что мы уже проверили
                  doc_type: attachment.doc_type! 
                },
                select: ['emailAttachmentId']
              }
            );
            
            const oldAttachmentId = oldStatement?.emailAttachmentId;
            console.log(`📋 Найдена старая ведомость ID: ${oldAttachmentId || 'нет'}`);
            
            // 6.2. Удаляем старые записи этого склада/типа
            await transactionalEntityManager.delete(ProcessedStatement, {
              sklad: attachment.sklad!,
              doc_type: attachment.doc_type!
            });
            console.log(`🗑️ Удалены старые записи склада ${attachment.sklad}, тип ${attachment.doc_type}`);
            
            // 6.3. Сбрасываем флаг у старой ведомости (если она существует и не текущая)
            if (oldAttachmentId && oldAttachmentId !== attachmentId) {
              await transactionalEntityManager.update(
                EmailAttachment,
                { id: oldAttachmentId },
                { in_process: false }
              );
              console.log(`🔄 Сброшен флаг in_process у ведомости ID: ${oldAttachmentId}`);
            }
            
            // 6.4. Парсим Excel и создаем записи
            const excelRows = this.parseExcel(filePath);
            const newStatements = this.createStatementsFromExcel(excelRows, attachment);
            
            // 6.5. Сохраняем новые записи
            const createdStatements = await transactionalEntityManager.save(
              ProcessedStatement,
              newStatements
            );
            console.log(`💾 Сохранено новых записей: ${createdStatements.length}`);
            
            // 6.6. Устанавливаем флаг у текущей ведомости
            await transactionalEntityManager.update(
              EmailAttachment,
              { id: attachmentId },
              { in_process: true }
            );
            console.log(`✅ Установлен флаг in_process у ведомости ID: ${attachmentId}`);
            
            // 6.7. Возвращаем созданные записи (выйдут из транзакции)
            return createdStatements;
          }
        );
        
        // 7. Транзакция успешно завершена - отправляем SSE
        this.appEventsService.notifyAll();
        console.log('📡 Отправлено SSE уведомление');
        
        // 8. Возвращаем результат
        return savedStatements;
        
      } catch (error) {
        // 9. Обработка ошибок транзакции
        console.error('💥 Ошибка в транзакции:', error);
        throw new InternalServerErrorException(
          `Ошибка обработки ведомости: ${error.message}`
        );
      }
    }
}    