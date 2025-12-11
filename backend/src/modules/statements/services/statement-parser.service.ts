import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
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
    
    private appEventsService: AppEventsService
  ) {}

  /**
   * Основной метод: открыть/распарсить ведомость
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatement[]> {
    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId }
    });
    
    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }
    
    // 2. Если ведомость ещё не обрабатывалась
    if (!attachment.in_process) {
      console.log(`🔄 Первое открытие ведомости ${attachmentId}`);
      
      // 2a. Удаляем старые данные того же склада и типа
      await this.cleanOldStatements(attachment);
      
      // 2b. Читаем и парсим Excel
      const excelRows = await this.readExcelFile(attachment.filename);
      
      // 2c. Создаём записи в processed_statements
      const createdStatements = await this.createStatementRecords(excelRows, attachment);
      
      // 2d. Обновляем флаг in_process
      await this.emailAttachmentRepo.update(attachmentId, { in_process: true });
      
      // 2e. Уведомляем об обновлении (для EmailModule)
      this.appEventsService.notifyAll();
      
      console.log(`✅ Создано ${createdStatements.length} записей`);
      return createdStatements;
    }
    
    // 3. Если ведомость уже обрабатывалась - возвращаем существующие записи
    console.log(`📄 Возвращаем существующие записи ведомости ${attachmentId}`);
    return await this.processedStatementRepo.find({
      where: { emailAttachmentId: attachmentId },
      order: { id: 'ASC' }
    });
  }

  /**
   * Удаление старых записей processed_statements того же склада и типа
   */
  private async cleanOldStatements(attachment: EmailAttachment): Promise<void> {
    if (!attachment.sklad || !attachment.doc_type) {
      return; // Нет данных для очистки
    }
    
    console.log(`🗑️ Удаление старых записей склада ${attachment.sklad}, тип ${attachment.doc_type}`);
    
    await this.processedStatementRepo.delete({
      sklad: attachment.sklad,
      doc_type: attachment.doc_type,
      emailAttachmentId: Not(attachment.id) // кроме текущего
    });
  }

  /**
   * Чтение Excel файла из папки email-attachments
   */
  private async readExcelFile(filename: string): Promise<any[]> {
    const emailAttachmentsDir = path.join(process.cwd(), '..', 'email-attachments');
    const filePath = path.join(emailAttachmentsDir, filename);
    
    console.log(`📖 Чтение файла: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл ${filename} не найден в папке email-attachments`);
    }
    
    try {
      // Читаем Excel
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Конвертируем в JSON
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📊 Прочитано ${data.length} строк из Excel`);
      
      return data;
      
    } catch (error) {
      throw new Error(`Ошибка чтения Excel файла: ${error.message}`);
    }
  }

  /**
   * Создание записей в processed_statements из данных Excel
   * Учитываем поле "Запас на конец периода" как количество
   */
  private async createStatementRecords(
    excelRows: any[], 
    attachment: EmailAttachment
  ): Promise<ProcessedStatement[]> {
    const createdStatements: ProcessedStatement[] = [];
    
    console.log(`🔨 Создание записей для ${excelRows.length} строк Excel`);
    
    for (const row of excelRows) {
      // Извлекаем данные из строки Excel
      const zavod = row['Завод']?.toString() || '';
      const sklad = row['Склад']?.toString() || attachment.sklad || '';
      const buhName = row['КрТекстМатериала']?.toString() || row['Материал']?.toString() || '';
      const invNumber = row['Материал']?.toString() || '';
      const partyNumber = row['Партия']?.toString() || '';
      
      // Количество из колонки "Запас на конец периода"
      const quantity = this.parseQuantity(row['Запас на конец периода']);
      
      // Создаём N записей (по количеству)
      for (let i = 0; i < quantity; i++) {
        const statement = this.processedStatementRepo.create({
          emailAttachmentId: attachment.id,
          sklad: sklad,
          doc_type: attachment.doc_type || 'ОСВ',
          zavod: zavod,
          inv_number: invNumber,
          party_number: partyNumber,
          buh_name: buhName,
          have_object: false,
          is_ignore: false
        });
        
        createdStatements.push(statement);
      }
    }
    
    // Сохраняем все записи разом
    return await this.processedStatementRepo.save(createdStatements);
  }

  /**
   * Парсинг количества из значения Excel
   */
  private parseQuantity(value: any): number {
    if (value === undefined || value === null || value === '') {
      return 1; // По умолчанию 1
    }
    
    // Пробуем преобразовать в число
    const num = Number(value);
    
    if (isNaN(num) || num <= 0) {
      return 1; // Если не число или <= 0, то 1
    }
    
    // Округляем до целого
    return Math.floor(num);
  }
}