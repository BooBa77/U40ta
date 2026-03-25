// imap.service.ts
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { EmailProcessor } from './email-processor.service';

@Injectable()
export class ImapService {
  private imap: Imap;

  constructor(
    private emailProcessor: EmailProcessor,
    private configService: ConfigService,
  ) {
    // Логируем конфигурацию при старте
    console.log('=== ImapService инициализирован ===');
    console.log('EMAIL_IMAP_USER:', this.configService.get('email.imap.user'));
    console.log('EMAIL_IMAP_HOST:', this.configService.get('email.imap.host'));
    console.log('EMAIL_IMAP_PORT:', this.configService.get('email.imap.port'));
    console.log('EMAIL_IMAP_TLS:', this.configService.get('email.imap.tls'));
    console.log('===================================');
  }

  public async checkForNewEmails(): Promise<void> {
    console.log('Проверка почты...');
    
    // Проверяем наличие обязательных параметров
    const user = this.configService.get('email.imap.user');
    const password = this.configService.get('email.imap.password');
    const host = this.configService.get('email.imap.host');
    const port = this.configService.get('email.imap.port');
    
    if (!user || !password) {
      const errorMsg = 'Отсутствуют учетные данные для IMAP. Проверьте переменные окружения EMAIL_IMAP_USER и EMAIL_IMAP_PASSWORD';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!host) {
      const errorMsg = 'Отсутствует хост IMAP. Проверьте переменную EMAIL_IMAP_HOST';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    return new Promise((resolve, reject) => {
      const imapConfig = {
        user: user,
        password: password,
        host: host,
        port: port,
        tls: this.configService.get('email.imap.tls') ?? true,
        tlsOptions: { rejectUnauthorized: false }
      };
      
      console.log('IMAP конфигурация для подключения:', {
        user: imapConfig.user,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls
      });
      
      this.imap = new Imap(imapConfig);

      this.imap.once('ready', async () => {
        console.log('✅ IMAP подключен к', host);
        try {
          await this.processNewEmails();
          this.imap.end();
          resolve();
        } catch (error) {
          console.error('Ошибка при обработке писем:', error);
          this.imap.end();
          reject(error);
        }
      });

      this.imap.once('error', (err) => {
        console.error('❌ IMAP ошибка:', err);
        console.error('Тип ошибки:', err.name);
        console.error('Сообщение ошибки:', err.message);
        console.error('Полный стек:', err.stack);
        
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
        
        reject(new Error(`Ошибка подключения: ${errorMessage}`));
      });

      console.log('Подключаемся к IMAP...');
      this.imap.connect();
    });
  }

  private async processNewEmails(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Ошибка открытия INBOX:', err);
          reject(new Error(`Ошибка открытия INBOX: ${err.message}`));
          return;
        }
        
        console.log('Папка INBOX открыта, сообщений:', box.messages.total);

        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('Ошибка поиска писем:', err);
            reject(new Error(`Ошибка поиска писем: ${err.message}`));
            return;
          }
          
          if (results && results.length > 0) {
            console.log(`📧 Найдено новых писем: ${results.length}`);
            this.processEmailsSequentially(results)
              .then(resolve)
              .catch(reject);
          } else {
            console.log('Новых писем нет');
            resolve();
          }
        });
      });
    });
  }

  private async processEmailsSequentially(uids: number[]): Promise<void> {
    for (const uid of uids) {
      try {
        console.log(`Обработка письма UID: ${uid}`);
        await this.processEmail(uid);
      } catch (error) {
        console.error(`Ошибка обработки письма ${uid}:`, error);
        // Продолжаем обработку следующих писем даже если одно упало
      }
    }
  }

  private async processEmail(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(uid, { 
        bodies: '', 
        struct: true 
      });
      
      fetch.on('message', (msg) => {
        let buffer = '';
        
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          
          stream.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer);
              await this.handleParsedEmail(parsed);
              
              // Помечаем письмо как прочитанное
              this.imap.addFlags(uid, ['\\Seen'], (err) => {
                if (err) {
                  console.error('Ошибка пометки письма:', err);
                } else {
                  console.log(`Письмо ${uid} помечено как прочитанное`);
                }
                resolve();
              });
            } catch (error) {
              console.error('Ошибка парсинга письма:', error);
              reject(error);
            }
          });
        });
      });
      
      fetch.once('error', (err) => {
        console.error('Ошибка получения письма:', err);
        reject(err);
      });
    });
  }

  private async handleParsedEmail(parsedEmail: any): Promise<void> {
    const fromAddress = parsedEmail.from?.value?.[0]?.address;
    console.log('Обрабатываем письмо от:', fromAddress);
    
    if (!parsedEmail.attachments || parsedEmail.attachments.length === 0) {
      console.log('Вложений нет, пропускаем');
      return;
    }

    console.log(`📎 Найдено вложений: ${parsedEmail.attachments.length}`);
    
    // Обрабатываем каждое вложение
    for (const attachment of parsedEmail.attachments) {
      try {
        console.log(`Обработка вложения: ${attachment.filename}, размер: ${attachment.size} байт`);
        await this.processAttachment(attachment, parsedEmail);
      } catch (error) {
        console.error(`Ошибка обработки вложения ${attachment.filename}:`, error);
        // Продолжаем обработку следующих вложений даже если одно упало
      }
    }
  }

  /**
   * Обрабатывает отдельное вложение
   */
  private async processAttachment(attachment: any, email: any): Promise<void> {
    // Вызываем сервис анализа с содержимым файла и метаданными
    await this.emailProcessor.analyzeAndSaveAttachment(
      attachment.content,    // Передаём Buffer напрямую
      attachment.filename,   // Оригинальное имя файла
      email.from?.value?.[0]?.address,
      email.subject
    );
  }
}