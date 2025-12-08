import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { EmailAttachment } from '../entities/email-attachment.entity';
import { AppEventsService } from '../../app-events/app-events.service'; // SSE
import { SmtpService } from './smtp.service';
import { EmailFileAnalyzer } from './email-file-analyzer.service';

@Injectable()
export class EmailProcessor {
  constructor(
    @InjectRepository(EmailAttachment)
    private attachmentsRepo: Repository<EmailAttachment>,
    private appEventsService: AppEventsService,
    private smtpService: SmtpService,
    private emailFileAnalyzer: EmailFileAnalyzer,
  ) {}

  async analyzeAndSaveAttachment(
    filePath: string,
    filename: string,
    emailFrom: string,
    emailSubject?: string
  ): Promise<EmailAttachment | null> {
    console.log(`🔄 Обрабатываем вложение: ${filename}`);
    
    try {
      // 1. Анализируем файл
      const analysis = await this.emailFileAnalyzer.analyzeExcel(filePath);
      
      // 2. Если файл валидный
      if (analysis.isValid) {
        // Сохраняем в БД
        const attachmentData = {
          filename: filename,
          email_from: emailFrom,
          received_at: new Date(),
          doc_type: analysis.docType,
          sklad: analysis.sklad
        };
        
        const savedRecord = await this.attachmentsRepo.save(attachmentData);
        this.appEventsService.notifyAll();
        console.log(`✅ Файл принят: ${filename}`);
        console.log('📡 SSE: отправлено обновление списка файлов');
        
        // Отправляем положительный ответ
        const acceptText = `Ваш файл "${filename}" принят.\n\n` +
                          `Тип документа: ${analysis.docType}\n` +
                          `Склад: ${analysis.sklad}\n\n` +
                          `Данные доступны в системе U40TA.`;
        
        await this.smtpService.sendEmail(
          emailFrom,
          `✅ Файл принят: ${filename}`,
          acceptText
        );
        
        return savedRecord;
        
      } else {
        // 3. Если файл кривой
        console.log(`❌ Файл отклонён: ${filename}, причина: ${analysis.error}`);
        
        // Отправляем отрицательный ответ
        const rejectText = `❌ Извините, Ваш файл "${filename}" не принят.\n\n` +
                          `Причина: ${analysis.error}\n\n`;
        
        await this.smtpService.sendEmail(
          emailFrom,
          `❌ Файл отклонён: ${filename}`,
          rejectText
        );
        
        // Удаляем файл с диска
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Файл удалён: ${filePath}`);
        } catch (deleteError) {
          console.error('Ошибка удаления файла:', deleteError);
        }
        
        return null;
      }
      
    } catch (error) {
      console.error(`💥 Ошибка обработки файла ${filename}:`, error);
      
      // Отправляем сообщение об ошибке
      const errorText = `При обработке вашего файла "${filename}" возникла непредвиденная ошибка.\n\n` +
                       `Ошибка: ${error.message}\n\n` +
                       `Администратор уведомлён.`;
      
      await this.smtpService.sendEmail(
        emailFrom,
        `⚠️ Ошибка обработки файла: ${filename}`,
        errorText
      );
      
      throw error;
    }
  }
}