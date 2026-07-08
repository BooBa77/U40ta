// backend/src/modules/email/services/email-processor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SmtpService } from './smtp.service';
import { EmailFileAnalyzer } from './email-file-analyzer.service';
import { LogsService } from '../../logs/logs.service';
import { UsersService } from '../../users/users.service';

/**
 * Сервис обработки вложений электронной почты.
 * 
 * ## Назначение
 * Координирует полный цикл обработки одного вложения, полученного по email:
 * анализ структуры, передача в соответствующий модуль (statements или inventory),
 * отправка уведомлений отправителю.
 * 
 * ## Два режима обработки
 * - **Обычная ведомость** (тема письма НЕ содержит "инвентар") — для МОЛ.
 *   Анализ → поиск пользователя по email → эмит события `statement.file.received`.
 *   Файл не сохраняется на диск.
 * - **Инвентаризационная ведомость** (тема содержит "инвентар") — для ревизоров.
 *   Анализ → эмит события `inventory.file.received`.
 *   Файл не сохраняется на диск.
 * 
 * ## Признак инвентаризационной ведомости
 * Определяется в ImapService по теме письма (ключевое слово "инвентар").
 * 
 * ## Обработка ошибок
 * - При ошибке обработки уведомление отправляется администратору
 *   (tregubovsy@irkutsk-dobycha.gazprom.ru)
 */
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  /**
   * Email администратора для уведомлений об ошибках обработки.
   */
  private readonly ADMIN_EMAIL = 'tregubovsy@irkutsk-dobycha.gazprom.ru';

  constructor(
    private smtpService: SmtpService,
    private emailFileAnalyzer: EmailFileAnalyzer,
    private logsService: LogsService,
    private usersService: UsersService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Нормализует email: приводит к нижнему регистру.
   * 
   * @param email - email для нормализации
   * @returns email в нижнем регистре
   */
  private normalizeEmail(email: string): string {
    return email?.toLowerCase().trim() || '';
  }

  /**
   * Проанализировать вложение и выполнить действие в зависимости от типа.
   * 
   * ## Процесс
   * 1. Определяет isInventory по теме письма
   * 2. Анализирует Excel через EmailFileAnalyzer.analyzeExcel(Buffer)
   * 3. Если файл невалидный — отправляет уведомление отправителю
   * 4. Если валидный и isInventory = true — эмитит событие для inventory-модуля
   * 5. Если валидный и isInventory = false — эмитит событие для statements-модуля
   * 
   * @param fileContent - содержимое файла в виде Buffer
   * @param originalFilename - оригинальное имя файла из письма
   * @param emailFrom - email отправителя
   * @param emailSubject - тема письма (для определения isInventory)
   */
  async analyzeAndSaveAttachment(
    fileContent: Buffer,
    originalFilename: string,
    emailFrom: string,
    emailSubject?: string
  ): Promise<void> {
    // Нормализуем email отправителя
    const normalizedEmail = this.normalizeEmail(emailFrom);
    
    this.logger.log(`Обрабатываем вложение: ${originalFilename}, отправитель: ${normalizedEmail}`);

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
          normalizedEmail,
          isInventory,
          analysis.error
        );
        return;
      }

      // ========== Файл валидный — действуем по типу ==========
      if (isInventory) {
        await this.handleInventoryAttachment(
          fileContent,
          originalFilename,
          normalizedEmail,
          analysis
        );
      } else {
        await this.handleStatementAttachment(
          fileContent,
          originalFilename,
          normalizedEmail,
          analysis
        );
      }

    } catch (error) {
      await this.handleProcessingError(originalFilename, normalizedEmail, error);
      throw error;
    }
  }

  /**
   * Обработать валидную инвентаризационную ведомость.
   * Эмитит событие `inventory.file.received` с Buffer, именем файла, email и docType.
   * 
   * @param buffer - содержимое файла
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя (нормализованный)
   * @param analysis - результат анализа (docType)
   */
  private async handleInventoryAttachment(
    buffer: Buffer,
    filename: string,
    emailFrom: string,
    analysis: { docType?: string; description?: string }
  ): Promise<void> {
    this.logger.log(`Инвентаризационная ведомость принята: ${filename}, тип: ${analysis.docType}`);

    this.logsService.log('backend', null, {
      action: 'inventory_file_accepted',
      filename,
      emailFrom,
      docType: analysis.docType,
      description: analysis.description
    });

    this.eventEmitter.emit('inventory.file.received', {
      buffer,
      filename,
      emailFrom,
      docType: analysis.docType
    });
  }

  /**
   * Обработать валидную обычную ведомость МОЛ.
   * Находит пользователя по email и эмитит событие `statement.file.received`.
   * 
   * Если пользователь не найден по email — отправляет уведомление отправителю
   * и администратору, файл не обрабатывается.
   * 
   * @param buffer - содержимое файла
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя (нормализованный)
   * @param analysis - результат анализа (docType, description)
   */
  private async handleStatementAttachment(
    buffer: Buffer,
    filename: string,
    emailFrom: string,
    analysis: { docType?: string; description?: string }
  ): Promise<void> {
    this.logger.log(`Ведомость МОЛ принята: ${filename}, тип: ${analysis.docType}, описание: ${analysis.description}`);

    // ========== Ищем пользователя по email (уже нормализован) ==========
    const user = await this.usersService.findByEmail(emailFrom);

    if (!user) {
      this.logger.warn(`Пользователь с email ${emailFrom} не найден, ведомость отклонена`);

      this.logsService.log('backend', null, {
        action: 'statement_file_rejected_user_not_found',
        filename,
        emailFrom,
        docType: analysis.docType
      });

      // Уведомляем отправителя
      const rejectText =
        `Извините, Ваш файл "${filename}" не принят.\n\n` +
        `Причина: Ваш email ${emailFrom} не зарегистрирован в системе U40TA как МОЛ.\n` +
        `Обратитесь к администратору для получения доступа.`;

      await this.smtpService.sendEmail(
        emailFrom,
        `Файл отклонён: ${filename}`,
        rejectText
      );

      // Уведомляем администратора
      await this.smtpService.sendEmail(
        this.ADMIN_EMAIL,
        `Неизвестный отправитель ведомости: ${filename}`,
        `Файл: ${filename}\nEmail: ${emailFrom}\nТип: ${analysis.docType}\nОписание: ${analysis.description}`
      );

      return;
    }

    // ========== Логируем успешный приём ==========
    this.logsService.log('backend', null, {
      action: 'statement_file_accepted',
      filename,
      emailFrom,
      userId: user.id,
      docType: analysis.docType,
      description: analysis.description
    });

    // ========== Эмитим событие для statements-модуля ==========
    this.eventEmitter.emit('statement.file.received', {
      buffer,
      filename,
      userId: user.id,
      docType: analysis.docType,
      description: analysis.description
    });

    // ========== Уведомление отправителю ==========
    const acceptText =
      `Ваш файл "${filename}" принят.\n\n` +
      `Тип документа: ${analysis.docType}\n` +
      `Описание: ${analysis.description}\n`;

    await this.smtpService.sendEmail(
      emailFrom,
      `Файл принят: ${filename}`,
      acceptText
    );
  }

  /**
   * Обработать невалидное вложение.
   * Отправляет уведомление отправителю с причиной отклонения.
   * 
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя (нормализованный)
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

    const rejectText =
      `Извините, Ваш файл "${filename}" не принят.\n\n` +
      `Причина: ${errorMessage || 'Неизвестная ошибка'}\n\n` +
      `Пожалуйста, проверьте структуру файла и отправьте снова.\n` +
      `Поддерживаемые форматы:\n` +
      `  - ОСВ (колонки: Завод, Склад, КрТекстМатериала, Материал, Партия, Запас на конец периода)\n` +
      `  - ОС (колонки: Название, Инвентарный номер, МОЛ)`;

    await this.smtpService.sendEmail(
      emailFrom,
      `Файл отклонён: ${filename}`,
      rejectText
    );
  }

  /**
   * Обработать непредвиденную ошибку при обработке вложения.
   * Отправляет уведомление администратору.
   * 
   * @param filename - оригинальное имя файла
   * @param emailFrom - email отправителя (нормализованный)
   * @param error - объект ошибки
   */
  private async handleProcessingError(
    filename: string,
    emailFrom: string,
    error: Error
  ): Promise<void> {
    this.logger.error(`Ошибка обработки файла ${filename}:`, error);

    this.logsService.log('backend', null, {
      action: 'email_processing_error',
      filename,
      emailFrom,
      error: error.message,
      stack: error.stack
    });

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