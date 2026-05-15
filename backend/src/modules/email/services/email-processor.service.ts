import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailAttachment } from '../entities/email-attachment.entity';
import { AppEventsService } from '../../app-events/app-events.service';
import { SmtpService } from './smtp.service';
import { EmailFileAnalyzer } from './email-file-analyzer.service';
import { EmailStorageService } from './email-storage.service';
import { LogsService } from '../../logs/logs.service';

/**
 * Сервис обработки вложений электронной почты.
 * 
 * ## Назначение
 * Координирует полный цикл обработки одного вложения, полученного по email:
 * анализ структуры, сохранение на диск и в БД (для обычных ведомостей),
 * передача в inventory-модуль (для инвентаризационных), отправка уведомлений.
 * 
 * ## Два режима обработки
 * - **Обычная ведомость** (is_inventory = false) — для МОЛ.
 *   Анализ → сохранение файла на диск → запись в email_attachments → SSE + уведомление.
 * - **Инвентаризационная ведомость** (is_inventory = true) — для ревизоров.
 *   Анализ → проверка валидности → эмит события `inventory.file.received` с Buffer.
 *   Файл не сохраняется на диск и в email_attachments.
 * 
 * ## Признак инвентаризационной ведомости is_inventory
 * Определяется в ImapService по теме письма (ключевое слово "инвентар").
 * 
 * ## Обработка ошибок
 * - При ошибке обработки уведомление отправляется администратору
 *   (tregubovsy@irkutsk-dobycha.gazprom.ru)
 * 
 * ## Использование
 * Вызывается из ImapService.processAttachment() для каждого вложения письма.
 */
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  /**
   * Email администратора для уведомлений об ошибках обработки.
   */
  private readonly ADMIN_EMAIL = 'tregubovsy@irkutsk-dobycha.gazprom.ru';

  constructor(
    @InjectRepository(EmailAttachment)
    private attachmentsRepo: Repository<EmailAttachment>,
    private appEventsService: AppEventsService,
    private smtpService: SmtpService,
    private emailFileAnalyzer: EmailFileAnalyzer,
    private emailStorageService: EmailStorageService,
    private logsService: LogsService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Проанализировать вложение и выполнить действие в зависимости от типа.
   * 
   * ## Процесс
   * 1. Определяет is_inventory по теме письма
   * 2. Анализирует Excel через EmailFileAnalyzer.analyzeExcel(Buffer)
   * 3. Если файл невалидный — отправляет уведомление отправителю
   * 4. Если валидный и is_inventory = true — эмитит событие для inventory-модуля
   * 5. Если валидный и is_inventory = false — сохраняет файл и запись в БД
   * 
   * @param fileContent - содержимое файла в виде Buffer
   * @param originalFilename - оригинальное имя файла из письма
   * @param emailFrom - email отправителя
   * @param emailSubject - тема письма (для определения is_inventory)
   * @returns EmailAttachment или null (для инвентаризационных всегда null)
   */
  async analyzeAndSaveAttachment(
    fileContent: Buffer,
    originalFilename: string,
    emailFrom: string,
    emailSubject?: string
  ): Promise<EmailAttachment | null> {
    this.logger.log(`Обрабатываем вложение: ${originalFilename}`);

    // ========== Определяем тип ведомости по теме письма ==========
    const isInventory = emailSubject?.toLowerCase().includes('инвентар') || false;

    this.logger.log(
      `Режим: ${isInventory ? 'инвентаризационный' : 'обычный'}, тема: ${emailSubject}`
    );

    try {
      // ========== Анализ Excel из Buffer ==========
      const analysis = await this.emailFileAnalyzer.analyzeExcel(fileContent);

      // ========== Файл невалидный — отклоняем ==========
      if (!analysis.isValid) {
        await this.handleInvalidAttachment(
          originalFilename,
          emailFrom,
          isInventory,
          analysis.error
        );
        return null;
      }

      // ========== Файл валидный — действуем по типу ==========
      if (isInventory) {
        // Инвентаризационная ведомость: эмитим событие для inventory-модуля
        await this.handleInventoryAttachment(
          fileContent,
          originalFilename,
          emailFrom,
          analysis
        );
        return null;
      } else {
        // Обычная ведомость: сохраняем на диск и в БД
        return await this.saveValidAttachment(
          fileContent,
          originalFilename,
          emailFrom,
          analysis
        );
      }

    } catch (error) {
      // ========== Непредвиденная ошибка ==========
      await this.handleProcessingError(originalFilename, emailFrom, error);
      throw error;
    }
  }

  /**
   * Обработать валидную инвентаризационную ведомость.
   * 
   * ## Действия
   * 1. Логирует успешный анализ
   * 2. Эмитит событие `inventory.file.received` с Buffer, именем файла и email отправителя
   * 3. Inventory-модуль слушает это событие и парсит строки в inventory_statements
   * 4. Отправляет SSE `inventory-statement-loaded` с ключом email (делает inventory-модуль)
   * 
   * Файл НЕ сохраняется на диск и НЕ создаётся запись в email_attachments.
   * 
   * @param buffer - содержимое файла
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя
   * @param analysis - результат анализа (docType)
   */
  private async handleInventoryAttachment(
    buffer: Buffer,
    filename: string,
    emailFrom: string,
    analysis: { docType?: string }
  ): Promise<void> {
    this.logger.log(`Инвентаризационная ведомость принята: ${filename}, тип: ${analysis.docType}`);

    this.logsService.log('backend', null, {
      action: 'inventory_file_accepted',
      filename,
      emailFrom,
      docType: analysis.docType
    });

    // Эмитим событие для inventory-модуля
    // InventoryStatementListener.OnInventoryFileReceived обработает его
    this.eventEmitter.emit('inventory.file.received', {
      buffer,
      filename,
      emailFrom,
      docType: analysis.docType
    });
  }

  /**
   * Сохранить валидную обычную ведомость МОЛ.
   * 
   * ## Действия
   * 1. Сохраняет файл на диск через EmailStorageService
   * 2. Создаёт запись в email_attachments
   * 3. Отправляет SSE statementLoaded
   * 4. Отправляет уведомление отправителю
   * 
   * @param buffer - содержимое файла
   * @param originalFilename - оригинальное имя файла
   * @param emailFrom - email отправителя
   * @param analysis - результат анализа (docType, zavod, sklad)
   * @returns Сохранённая запись EmailAttachment
   */
  private async saveValidAttachment(
    buffer: Buffer,
    originalFilename: string,
    emailFrom: string,
    analysis: { docType?: string; zavod?: number; sklad?: string }
  ): Promise<EmailAttachment> {
    // ========== Шаг 1: Сохраняем файл на диск ==========
    const { filePath, uniqueFilename } = await this.emailStorageService.saveFile(
      originalFilename,
      buffer
    );

    this.logger.log(`Файл сохранён на диск: ${uniqueFilename}`);

    // ========== Шаг 2: Создаём запись в БД ==========
    const attachmentData = {
      filename: uniqueFilename,
      emailFrom,
      receivedAt: new Date(),
      docType: analysis.docType,
      zavod: analysis.zavod || 0,
      sklad: analysis.sklad || '',
      inProcess: false
    };

    const savedRecord = await this.attachmentsRepo.save(attachmentData);

    this.logger.log(
      `Запись в БД создана: id=${savedRecord.id}, тип=${analysis.docType}, ` +
      `склад=${analysis.sklad}`
    );

    // ========== Шаг 3: SSE-уведомление ==========
    this.appEventsService.notifyStatementLoaded();

    // ========== Шаг 4: Логирование ==========
    this.logsService.log('backend', null, {
      action: 'email_attachment_accepted',
      filename: uniqueFilename,
      emailFrom,
      docType: analysis.docType,
      zavod: analysis.zavod,
      sklad: analysis.sklad
    });

    // ========== Шаг 5: Уведомление отправителю ==========
    const acceptText =
      `Ваш файл "${originalFilename}" принят.\n\n` +
      `Тип документа: ${analysis.docType}\n` +
      `Склад: ${analysis.sklad}\n`;

    await this.smtpService.sendEmail(
      emailFrom,
      `Файл принят: ${originalFilename}`,
      acceptText
    );

    return savedRecord;
  }

  /**
   * Обработать невалидное вложение.
   * 
   * ## Действия
   * 1. Логирует отклонение
   * 2. Отправляет уведомление отправителю с причиной
   * 
   * Файл не сохранялся на диск — удалять нечего.
   * 
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя
   * @param isInventory - признак инвентаризационной ведомости
   * @param errorMessage - причина отклонения
   */
  private async handleInvalidAttachment(
    filename: string,
    emailFrom: string,
    isInventory: boolean,
    errorMessage?: string
  ): Promise<void> {
    const typeLabel = isInventory ? 'инвентаризационная' : 'обычная';
    this.logger.log(`${typeLabel} ведомость отклонена: ${filename}, причина: ${errorMessage}`);

    this.logsService.log('backend', null, {
      action: 'email_attachment_rejected',
      filename,
      emailFrom,
      isInventory,
      reason: errorMessage
    });

    // Отправляем уведомление отправителю
    const rejectText =
      `Извините, Ваш файл "${filename}" не принят.\n\n` +
      `Причина: ${errorMessage || 'Неизвестная ошибка'}\n\n` +
      `Пожалуйста, проверьте структуру файла и отправьте снова.\n` +
      `Поддерживаемые форматы:\n` +
      `  - ОСВ (колонки: Завод, Склад, КрТекстМатериала, Материал, Партия, Запас на конец периода)\n` +
      `  - ОС (колонки: Основное средство, Название, Инвентарный номер, МОЛ)`;

    await this.smtpService.sendEmail(
      emailFrom,
      `Файл отклонён: ${filename}`,
      rejectText
    );
  }

  /**
   * Обработать непредвиденную ошибку при обработке вложения.
   * 
   * ## Действия
   * 1. Логирует ошибку
   * 2. Отправляет уведомление администратору (не отправителю)
   * 
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя (для контекста в логах)
   * @param error - объект ошибки
   */
  private async handleProcessingError(
    filename: string,
    emailFrom: string,
    error: Error
  ): Promise<void> {
    this.logger.error(`Ошибка обработки файла ${filename}:`, error);

    // ========== Логируем ошибку ==========
    this.logsService.log('backend', null, {
      action: 'email_processing_error',
      filename,
      emailFrom,
      error: error.message,
      stack: error.stack
    });

    // ========== Отправляем уведомление администратору ==========
    const errorText =
      `Ошибка обработки вложения.\n\n` +
      `Файл: ${filename}\n` +
      `Отправитель: ${emailFrom}\n` +
      `Ошибка: ${error.message}\n\n` +
      `Стек: ${error.stack}`;

    await this.smtpService.sendEmail(
      this.ADMIN_EMAIL,
      `Ошибка обработки файла: ${filename}`,
      errorText
    );
  }
}