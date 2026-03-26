import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../entities/email-attachment.entity';
import { AppEventsService } from '../../app-events/app-events.service';
import { SmtpService } from './smtp.service';
import { EmailFileAnalyzer } from './email-file-analyzer.service';
import { EmailStorageService } from './email-storage.service';
import { LogsService } from '../../logs/logs.service';

@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailFileAnalyzer.name);
  constructor(
    @InjectRepository(EmailAttachment)
    private attachmentsRepo: Repository<EmailAttachment>,
    private appEventsService: AppEventsService,
    private smtpService: SmtpService,
    private emailFileAnalyzer: EmailFileAnalyzer,
    private emailStorageService: EmailStorageService,
    private logsService: LogsService,
  ) {}

  async analyzeAndSaveAttachment(
    fileContent: Buffer,
    originalFilename: string,
    emailFrom: string,
    emailSubject?: string
  ): Promise<EmailAttachment | null> {
    this.logger.log(`Обрабатываем вложение: ${originalFilename}`);
    
    const isInventory = emailSubject?.toLowerCase().includes('инвентаризац') || false;

    try {
      // 1. Сохраняем файл на диск через EmailStorageService
      const { filePath, uniqueFilename } = await this.emailStorageService.saveFile(
        originalFilename,
        fileContent
      );

      // 2. Анализируем файл
      const analysis = await this.emailFileAnalyzer.analyzeExcel(filePath);
      
      // 3. Если файл валидный - сохраняем в БД
      if (analysis.isValid) {
        return await this.saveValidAttachment(
          uniqueFilename,
          emailFrom,
          analysis,
          isInventory
        );
      } 
      
      // 4. Если файл невалидный - удаляем и отправляем уведомление
      await this.handleInvalidAttachment(
        uniqueFilename, 
        emailFrom, 
        analysis.error
      );
      return null;
      
    } catch (error) {
      await this.handleProcessingError(originalFilename, emailFrom, error);
      throw error;
    }
  }

  private async saveValidAttachment(
    filename: string,
    emailFrom: string,
    analysis: { docType?: string; zavod?: number; sklad?: string },
    isInventory: boolean
  ): Promise<EmailAttachment> {
    const attachmentData = {
      filename: filename,
      emailFrom: emailFrom,
      receivedAt: new Date(),
      docType: analysis.docType,
      zavod: analysis.zavod,
      sklad: analysis.sklad,
      isInventory: isInventory,
      inProcess: false // По умолчанию
    };
    
    const savedRecord = await this.attachmentsRepo.save(attachmentData);
    
    // SSE уведомление о новой ведомости
    this.appEventsService.notifyStatementLoaded();
    this.logger.log(`Файл принят: ${filename}`);
    this.logsService.log('backend', null, {
      action: 'email_attachment_accepted',
      filename: filename,
      emailFrom: emailFrom,
      docType: analysis.docType,
      zavod: analysis.zavod,
      sklad: analysis.sklad,
      isInventory: isInventory
    });    
    
    // Отправляем положительный ответ
    const acceptText = `Ваш файл "${filename}" принят.\n\n` +
                      `Тип документа: ${analysis.docType}\n` +
                      `Склад: ${analysis.sklad}\n\n`;
    
    await this.smtpService.sendEmail(
      emailFrom,
      `Файл принят: ${filename}`,
      acceptText
    );
    
    return savedRecord;
  }

  private async handleInvalidAttachment(
    filename: string,
    emailFrom: string,
    errorMessage?: string
  ): Promise<void> {
    this.logger.log(`Файл отклонён: ${filename}, причина: ${errorMessage}`);
    this.logsService.log('backend', null, {
      action: 'email_attachment_rejected',
      filename: filename,
      emailFrom: emailFrom,
      reason: errorMessage
    });    
    
    // Удаляем файл с диска
    try {
      await this.emailStorageService.deleteFile(filename);
      this.logger.log(`Файл удалён: ${filename}`);
    } catch (deleteError) {
      this.logger.log('Ошибка удаления файла:', deleteError);
    }
    
    // Отправляем отрицательный ответ
    const rejectText = `Извините, Ваш файл "${filename}" не принят.\n\n` +
                      `Причина: ${errorMessage}\n\n`;
    
    await this.smtpService.sendEmail(
      emailFrom,
      `Файл отклонён: ${filename}`,
      rejectText
    );
  }

  private async handleProcessingError(
    filename: string,
    emailFrom: string,
    error: Error
  ): Promise<void> {
    this.logger.log(`Ошибка обработки файла ${filename}:`, error);
    this.logsService.log('backend', null, {
      action: 'email_processing_error',
      filename: filename,
      emailFrom: emailFrom,
      error: error.message,
      stack: error.stack
    });    
    
    // Отправляем сообщение об ошибке
    const errorText = `При обработке вашего файла "${filename}" возникла непредвиденная ошибка.\n\n` +
                     `Ошибка: ${error.message}\n\n`;
    
    await this.smtpService.sendEmail(
      emailFrom,
      `Ошибка обработки файла: ${filename}`,
      errorText
    );
  }
}