import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../entities/email-attachment.entity';

@Injectable()
export class FileAnalysisService {
  constructor(
    @InjectRepository(EmailAttachment)
    private attachmentsRepo: Repository<EmailAttachment>,
  ) {}

  /**
   * Анализирует файл и создает запись в БД
   * @param filePath - путь к сохраненному файлу
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя
   */
  async analyzeAndSaveAttachment(
    filePath: string, 
    filename: string, 
    emailFrom: string,
    emailSubject?: string
  ): Promise<EmailAttachment> {
    
    // Определяем тип документа по теме письма
  const determinedDocType = emailSubject && emailSubject.toLowerCase().includes('инвентаризаци') 
    ? 'ИО' 
    : null;

    // Создаем объект записи БЕЗ использования this.attachmentsRepo.create()
    const attachmentData = {
      filename: filename,
      email_from: emailFrom,
      received_at: new Date(),
      // good_file: true,
      doc_type: determinedDocType,
      sklad: null,
      error_reason: null
    };

    // Сохраняем напрямую через save()
    const savedRecord = await this.attachmentsRepo.save(attachmentData);
    console.log('📝 Создана запись в БД для файла:', filename);
    
    return savedRecord;
  }
}