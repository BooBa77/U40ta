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
import { ParsedOSVExcelRowDto } from '../dto/parsed-osv-excel-row.dto';
import { ParsedOSExcelRowDto } from '../dto/parsed-os-excel-row.dto';
import { ProcessedStatementDto } from '../dto/statement-response.dto';

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
  async getExistingStatements(attachmentId: number): Promise<ProcessedStatementDto[]> {
    const entities = await this.processedStatementRepo.find({
      where: { emailAttachmentId: attachmentId },
      order: { id: 'ASC' },
    });
    
    // Преобразуем Entity в DTO
    return ProcessedStatementDto.fromEntities(entities);
  }

  /**
   * Публичный метод: основной парсинг ведомости
   * Создает записи в processed_statements
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatementDto[]> {
    //console.log(`StatementParserService: парсинг ведомости ID: ${attachmentId}`);
    
    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
    });
    
    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }
    
    // 2. Пропускаем инвентаризацию
    if (attachment.isInventory) {
      //console.log(`StatementParserService: пропускаем инвентаризацию (ID: ${attachmentId})`);
      return [];
    }
    
    // 3. Если ведомость уже в работе - возвращаем существующие записи
    if (attachment.inProcess) {
      //console.log(`StatementParserService: ведомость уже в работе`);
      return await this.getExistingStatements(attachmentId);
    }
    
    // 4. Проверяем наличие файла
    const filePath = this.getFilePath(attachment.filename);
    if (!fs.existsSync(filePath)) {
      throw new InternalServerErrorException(`Файл не найден: ${attachment.filename}`);
    }
    
    // 5. Проверяем обязательные поля
    if (!attachment.sklad || !attachment.docType) {
      throw new InternalServerErrorException(
        `У вложения отсутствует склад (${attachment.sklad}) или тип документа (${attachment.docType})`,
      );
    }
    
    // 6. Транзакция (все операции атомарно)
    let savedEntities: ProcessedStatement[] = [];
    
    try {
      // Очищаем старую ведомость и подготавливаем место для новой
      await this.prepareForNewStatement(attachment);

      // Разветвление по типу документа
      if (attachment.docType === 'ОСВ') {
        const excelRows = this.parseOSVExcel(filePath);
        const newEntities = this.createOSVStatementsFromExcel(excelRows, attachment);
        savedEntities = await this.saveStatementsInTransaction(newEntities, attachment);
      } else if (attachment.docType === 'ОС') {
        const excelRows = this.parseOSExcel(filePath);
        const newEntities = this.createOSStatementsFromExcel(excelRows, attachment);
        savedEntities = await this.saveStatementsInTransaction(newEntities, attachment);
      } else {
        throw new InternalServerErrorException(`Неизвестный тип документа: ${attachment.docType}`);
      }
    
      this.appEventsService.notifyStatementActiveChanged(attachmentId, attachment.zavod, attachment.sklad);
      //console.log('StatementParserService: отправлено SSE уведомление');
      
      return ProcessedStatementDto.fromEntities(savedEntities);
      
    } catch (error) {
      //console.error('StatementParserService: ошибка обработки ведомости:', error);
      throw new InternalServerErrorException(
        `Ошибка обработки ведомости: ${error.message}`,
      );
    }
  }

  /**
   * Подготовка. Удаление старых записей и сброс флага у предыдущей активной ведомости
   */
  private async prepareForNewStatement(attachment: EmailAttachment): Promise<void> {
    await this.entityManager.transaction(async (transactionalEntityManager) => {
      // Находим старую активную ведомость
      const oldStatement = await transactionalEntityManager.findOne(
        ProcessedStatement,
        {
          where: { 
            sklad: attachment.sklad || '',
            doc_type: attachment.docType || '',
          },
          select: ['emailAttachmentId'],
        },
      );
      
      const oldAttachmentId = oldStatement?.emailAttachmentId;
      //console.log(`StatementParserService: найдена старая ведомость ID: ${oldAttachmentId || 'нет'}`);
      
      // Удаляем старые записи этого склада/типа
      await transactionalEntityManager.delete(ProcessedStatement, {
        sklad: attachment.sklad,
        doc_type: attachment.docType,
      });
      //console.log(`StatementParserService: удалены старые записи склада ${attachment.sklad}, тип ${attachment.docType}`);
      
      // Сбрасываем флаг у старой ведомости
      if (oldAttachmentId && oldAttachmentId !== attachment.id) {
        await transactionalEntityManager.update(
          EmailAttachment,
          { id: oldAttachmentId },
          { inProcess: false },
        );
        //console.log(`StatementParserService: сброшен флаг in_process у ведомости ID: ${oldAttachmentId}`);
      }
    });
  }

  /**
   * Сохранение новых записей и установка флага активной ведомости
   */
  private async saveStatementsInTransaction(
    newEntities: ProcessedStatement[],
    attachment: EmailAttachment
  ): Promise<ProcessedStatement[]> {
    return await this.entityManager.transaction(async (transactionalEntityManager) => {
      // Сохраняем новые записи
      const createdEntities = await transactionalEntityManager.save(
        ProcessedStatement,
        newEntities,
      );
      //console.log(`StatementParserService: сохранено записей: ${createdEntities.length}`);
      
      // Устанавливаем флаг у текущей ведомости
      await transactionalEntityManager.update(
        EmailAttachment,
        { id: attachment.id },
        { inProcess: true },
      );
      //console.log(`StatementParserService: установлен флаг in_process у ведомости ID: ${attachment.id}`);
      
      return createdEntities;
    });
  }

  private parseOSVExcel(filePath: string): ParsedOSVExcelRowDto[] {
    //console.log(`StatementParserService: чтение Excel файла ОСВ: ${filePath}`);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data: ParsedOSVExcelRowDto[] = XLSX.utils.sheet_to_json(worksheet);
      
      //console.log(`StatementParserService: прочитано строк ОСВ: ${data.length}`);
      return data;
      
    } catch (error) {
      //console.error('StatementParserService: ошибка чтения Excel ОСВ:', error);
      throw new InternalServerErrorException(`Ошибка чтения Excel файла ОСВ: ${error.message}`);
    }
  }

  private parseOSExcel(filePath: string): ParsedOSExcelRowDto[] {
    //console.log(`StatementParserService: чтение Excel файла ОС: ${filePath}`);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      //console.log(`StatementParserService: прочитано строк ОС: ${data.length}`);
      
      const result: ParsedOSExcelRowDto[] = data.map(row => ({
        'Основное средство': row['Основное средство']?.toString(),
        'Название': row['Название']?.toString(),
        'Инвентарный номер': row['Инвентарный номер']?.toString(),
        'МОЛ': row['МОЛ']?.toString(),
      }));
      
      return result;
      
    } catch (error) {
      //console.error('StatementParserService: ошибка чтения Excel ОС:', error);
      throw new InternalServerErrorException(`Ошибка чтения Excel файла ОС: ${error.message}`);
    }
  }

  private createOSVStatementsFromExcel(
    excelRows: ParsedOSVExcelRowDto[],
    attachment: EmailAttachment,
  ): ProcessedStatement[] {
    const statements: ProcessedStatement[] = [];
    
    for (const row of excelRows) {
      const zavod = row['Завод'] ? parseInt(row['Завод'].toString()) : 0;
      const sklad = row['Склад']?.toString() || attachment.sklad || '';
      const buhName = row['КрТекстМатериала']?.toString() || row['Материал']?.toString() || '';
      const invNumber = row['Материал']?.toString() || '';
      const partyNumber = row['Партия']?.toString() || '';

      if (!invNumber || invNumber.trim() === '') {
        //console.log(`StatementParserService: пропущена сводная строка ОСВ: "${buhName.substring(0, 50)}..."`);
        continue;
      }
      
      let quantity = 1;
      const quantityValue = row['Запас на конец периода'];
      if (quantityValue !== undefined && quantityValue !== null) {
        const num = Number(quantityValue);
        if (!isNaN(num) && num > 0) {
          quantity = Math.floor(num);
        }
      }
      
      for (let i = 0; i < quantity; i++) {
        const statement = new ProcessedStatement();
        statement.emailAttachmentId = attachment.id;
        statement.sklad = sklad;
        statement.doc_type = attachment.docType || 'ОСВ';
        statement.zavod = zavod;
        statement.buh_name = buhName;
        statement.inv_number = invNumber;
        statement.party_number = partyNumber;
        statement.have_object = false;
        statement.is_ignore = false;
        statement.is_excess = false;
        
        statements.push(statement);
      }
    }
    
    //console.log(`StatementParserService: создано объектов ОСВ: ${statements.length}`);
    return statements;
  }

    private createOSStatementsFromExcel(
      excelRows: ParsedOSExcelRowDto[],
      attachment: EmailAttachment,
    ): ProcessedStatement[] {
      const statements: ProcessedStatement[] = [];
      
      for (const row of excelRows) {
        const buhName = row['Название']?.trim() || '';
        const invNumber = row['Инвентарный номер']?.trim() || '';
        const sklad = row['МОЛ']?.toString().trim() || attachment.sklad || '';
        
        // Пропускаем строки с пустыми обязательными полями
        if (!buhName || !invNumber || !sklad) {
          //console.log(`StatementParserService: пропущена строка ОС с пустыми полями: Название=${buhName}, Инвентарный номер=${invNumber}, МОЛ=${sklad}`);
          continue;
        }
        
        const statement = new ProcessedStatement();
        statement.emailAttachmentId = attachment.id;
        statement.sklad = sklad;
        statement.doc_type = attachment.docType || 'ОС';
        statement.zavod = 0;
        statement.buh_name = buhName;
        statement.inv_number = invNumber;
        statement.party_number = '-';
        statement.have_object = false;
        statement.is_ignore = false;
        statement.is_excess = false;
        
        statements.push(statement);
      }
      
      //console.log(`StatementParserService: создано объектов ОС: ${statements.length}`);
      return statements;
  }

  /**
   * Формирует полный путь к файлу
   */
  private getFilePath(filename: string): string {
    const projectRoot = process.cwd();
    const emailAttachmentsDir = path.join(projectRoot, '..', 'email-attachments');
    const filePath = path.join(emailAttachmentsDir, filename);
    return filePath;
  }
}