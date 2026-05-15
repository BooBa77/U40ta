import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { EmailProcessor } from './email-processor.service';
import { LogsService } from '../../logs/logs.service';

/**
 * Сервис для работы с почтовым ящиком по протоколу IMAP.
 * 
 * ## Назначение
 * Подключается к почтовому серверу, ищет непрочитанные письма,
 * извлекает вложения и передаёт их в EmailProcessor для дальнейшей обработки.
 * После успешной обработки помечает письма как прочитанные.
 * 
 * ## Процесс проверки почты
 * 1. Подключение к IMAP-серверу с параметрами из конфига
 * 2. Открытие ящика INBOX
 * 3. Поиск непрочитанных писем (UNSEEN)
 * 4. Последовательная обработка каждого письма:
 *    - Извлечение темы, отправителя и вложений
 *    - Определение признака is_inventory по теме письма
 *    - Передача вложений в EmailProcessor
 *    - Пометка письма как прочитанного
 * 5. Закрытие соединения
 * 
 * ## Определение is_inventory
 * При обработке письма тема проверяется на вхождение подстроки "инвентар"
 * (регистронезависимо). Результат передаётся в EmailProcessor, который
 * устанавливает флаг is_inventory в записях email_attachments.
 * 
 * ## Обработка ошибок
 * - При ошибке подключения — выбрасывается понятное сообщение
 * - При ошибке обработки одного письма — логируется, остальные продолжают обрабатываться
 * - Все ошибки логируются в таблицу logs
 * 
 * ## Использование
 * Вызывается из EmailController.checkEmailNow() при ручной проверке почты,
 * а также может вызываться по расписанию (cron).
 */
@Injectable()
export class ImapService {
  private imap: Imap;
  private readonly logger = new Logger(ImapService.name);

  constructor(
    private emailProcessor: EmailProcessor,
    private configService: ConfigService,
    private logsService: LogsService,
  ) {}

  /**
   * Запустить проверку новых писем.
   * 
   * ## Процесс
   * 1. Проверяет наличие обязательных учётных данных (user, password, host)
   * 2. Подключается к IMAP-серверу
   * 3. Обрабатывает непрочитанные письма
   * 4. Закрывает соединение
   * 
   * ## Ошибки
   * - Если отсутствуют учётные данные — выбрасывает ошибку с понятным сообщением
   * - Если ошибка аутентификации — формирует читаемое сообщение
   * - Если таймаут подключения — также понятное сообщение
   * 
   * @returns Promise, который разрешается после завершения обработки
   * @throws Error с читаемым сообщением при проблемах подключения
   */
  public async checkForNewEmails(): Promise<void> {
    this.logger.log('Проверка почты...');

    // ========== Проверка наличия обязательных параметров ==========
    const user = this.configService.get('email.imap.user');
    const password = this.configService.get('email.imap.password');
    const host = this.configService.get('email.imap.host');
    const port = this.configService.get('email.imap.port');

    if (!user || !password) {
      const errorMsg =
        'Отсутствуют учетные данные для IMAP. ' +
        'Проверьте переменные окружения EMAIL_IMAP_USER и EMAIL_IMAP_PASSWORD';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!host) {
      const errorMsg =
        'Отсутствует хост IMAP. Проверьте переменную EMAIL_IMAP_HOST';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // ========== Подключение и обработка ==========
    return new Promise((resolve, reject) => {
      // Формируем конфиг подключения
      const imapConfig = {
        user: user,
        password: password,
        host: host,
        port: port,
        tls: this.configService.get('email.imap.tls') ?? true,
        tlsOptions: { rejectUnauthorized: false }
      };

      this.imap = new Imap(imapConfig);

      // ========== Обработчик успешного подключения ==========
      this.imap.once('ready', async () => {
        this.logger.log('IMAP подключен');
        try {
          // Обрабатываем новые письма
          await this.processNewEmails();

          // Закрываем соединение
          this.imap.end();
          resolve();
        } catch (error) {
          this.logger.error('Ошибка при обработке писем:', error);
          this.imap.end();
          reject(error);
        }
      });

      // ========== Обработчик ошибок IMAP ==========
      this.imap.once('error', (err) => {
        this.logger.error('IMAP ошибка:', err);
        this.logger.error('Тип ошибки:', err.name);
        this.logger.error('Сообщение ошибки:', err.message);
        this.logger.error('Полный стек:', err.stack);

        // Формируем понятное сообщение об ошибке
        let errorMessage = err.message;
        if (err.message && err.message.toLowerCase().includes('authentication')) {
          errorMessage = 'Ошибка аутентификации. Проверьте логин и пароль.';
        } else if (err.message && err.message.toLowerCase().includes('connect')) {
          errorMessage = 'Не удалось подключиться к серверу. Проверьте хост и порт.';
        } else if (err.message && err.message.toLowerCase().includes('timeout')) {
          errorMessage = 'Таймаут подключения. Проверьте сетевое соединение.';
        } else if (!err.message || err.message === '') {
          errorMessage = 'Неизвестная ошибка подключения. Проверьте настройки IMAP.';
        }

        this.logsService.log('backend', null, {
          action: 'imap_error',
          error: errorMessage,
          originalError: err.message
        });

        reject(new Error(`Ошибка подключения: ${errorMessage}`));
      });

      // ========== Запускаем подключение ==========
      this.logger.log('Подключаемся к IMAP...');
      this.imap.connect();
    });
  }

  /**
   * Найти и последовательно обработать все непрочитанные письма.
   * 
   * ## Процесс
   * 1. Открывает ящик INBOX в режиме только чтение
   * 2. Ищет все письма с флагом UNSEEN (непрочитанные)
   * 3. Обрабатывает письма последовательно (по одному)
   * 4. Если писем нет — логирует и завершает
   * 
   * @returns Promise, который разрешается после обработки всех писем
   */
  private async processNewEmails(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Открываем INBOX
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          this.logger.error('Ошибка открытия INBOX:', err);
          reject(new Error(`Ошибка открытия INBOX: ${err.message}`));
          return;
        }

        // Ищем непрочитанные письма
        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            this.logger.error('Ошибка поиска писем:', err);
            reject(new Error(`Ошибка поиска писем: ${err.message}`));
            return;
          }

          if (results && results.length > 0) {
            this.logger.log(`Найдено новых писем: ${results.length}`);
            // Обрабатываем письма последовательно
            this.processEmailsSequentially(results)
              .then(resolve)
              .catch(reject);
          } else {
            this.logger.log('Новых писем нет');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Последовательно обработать список писем по UID.
   * 
   * ## Поведение при ошибках
   * Если одно письмо вызывает ошибку — оно логируется, но обработка
   * остальных писем продолжается. Это гарантирует, что проблемное письмо
   * не заблокирует получение остальных.
   * 
   * @param uids - массив UID писем для обработки
   * @returns Promise, который разрешается после обработки всех писем
   */
  private async processEmailsSequentially(uids: number[]): Promise<void> {
    for (const uid of uids) {
      try {
        this.logger.log(`Обработка письма UID: ${uid}`);
        await this.processEmail(uid);
      } catch (error) {
        this.logger.error(`Ошибка обработки письма ${uid}:`, error);
        // Продолжаем обработку следующих писем даже если одно упало
      }
    }
  }

  /**
   * Обработать одно письмо по UID.
   * 
   * ## Процесс
   * 1. Извлекает тело письма через IMAP fetch
   * 2. Парсит письмо через mailparser (simpleParser)
   * 3. Передаёт распарсенное письмо в handleParsedEmail
   * 4. После успешной обработки помечает письмо как прочитанное (флаг \Seen)
   * 
   * @param uid - UID письма для обработки
   * @returns Promise, который разрешается после обработки и пометки письма
   */
  private async processEmail(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Извлекаем тело письма и его структуру
      const fetch = this.imap.fetch(uid, {
        bodies: '',
        struct: true
      });

      fetch.on('message', (msg) => {
        let buffer = '';

        // Собираем тело письма по частям
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });

          // Когда тело письма полностью получено — парсим
          stream.once('end', async () => {
            try {
              // Парсим письмо (тема, отправитель, вложения)
              const parsed = await simpleParser(buffer);

              // Обрабатываем распарсенное письмо
              await this.handleParsedEmail(parsed);

              // Помечаем письмо как прочитанное
              this.imap.addFlags(uid, ['\\Seen'], (err) => {
                if (err) {
                  this.logger.error('Ошибка пометки письма:', err);
                } else {
                  this.logger.log(`Письмо ${uid} помечено как прочитанное`);
                }
                resolve();
              });
            } catch (error) {
              this.logger.error('Ошибка парсинга письма:', error);
              reject(error);
            }
          });
        });
      });

      fetch.once('error', (err) => {
        this.logger.error('Ошибка получения письма:', err);
        reject(err);
      });
    });
  }

  /**
   * Обработать распарсенное письмо: извлечь и передать вложения в EmailProcessor.
   * 
   * ## Процесс
   * 1. Логирует отправителя письма
   * 2. Если вложений нет — пропускает письмо
   * 3. Для каждого вложения вызывает processAttachment
   * 
   * ## Примечание
   * Тема письма (email.subject) передаётся в EmailProcessor вместе с каждым
   * вложением. Там она используется для определения is_inventory.
   * 
   * @param parsedEmail - распарсенное письмо от mailparser
   */
  private async handleParsedEmail(parsedEmail: any): Promise<void> {
    const fromAddress = parsedEmail.from?.value?.[0]?.address;
    this.logger.log('Обрабатываем письмо от:', fromAddress);

    // Если вложений нет — нечего обрабатывать
    if (!parsedEmail.attachments || parsedEmail.attachments.length === 0) {
      this.logger.log('Вложений нет, пропускаем');
      return;
    }

    this.logger.log(`Найдено вложений: ${parsedEmail.attachments.length}`);

    // Обрабатываем каждое вложение
    for (const attachment of parsedEmail.attachments) {
      try {
        this.logger.log(
          `Обработка вложения: ${attachment.filename}, размер: ${attachment.size} байт`
        );
        await this.processAttachment(attachment, parsedEmail);
      } catch (error) {
        this.logger.error(
          `Ошибка обработки вложения ${attachment.filename}:`,
          error
        );
        // Продолжаем обработку следующих вложений даже если одно упало
      }
    }
  }

  /**
   * Передать отдельное вложение в EmailProcessor для анализа и сохранения.
   * 
   * ## Передаваемые данные
   * - `attachment.content` — содержимое файла (Buffer)
   * - `attachment.filename` — оригинальное имя файла
   * - `email.from` — адрес отправителя
   * - `email.subject` — тема письма (используется для определения is_inventory)
   * 
   * @param attachment - объект вложения от mailparser
   * @param email - полное распарсенное письмо (для доступа к теме и отправителю)
   */
  private async processAttachment(attachment: any, email: any): Promise<void> {
    // Передаём вложение в EmailProcessor:
    // - содержимое файла (Buffer)
    // - оригинальное имя файла
    // - адрес отправителя
    // - тему письма (для определения is_inventory по ключевому слову "инвентар")
    await this.emailProcessor.analyzeAndSaveAttachment(
      attachment.content,
      attachment.filename,
      email.from?.value?.[0]?.address,
      email.subject
    );
  }
}