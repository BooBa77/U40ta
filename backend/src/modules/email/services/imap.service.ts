import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import { EmailAttachment } from '../entities/email-attachment.entity';

@Injectable()
export class ImapService implements OnModuleInit {
  private imap: Imap;
  private isConnected = false;

  constructor(
    @InjectRepository(EmailAttachment)
    private attachmentsRepo: Repository<EmailAttachment>,
  ) {}

  async onModuleInit() {
    await this.setupImapConnection();
  }

  private async setupImapConnection() {
    this.imap = new Imap({
      user: 'u40ta@mail.ru',
      password: 'YxTNPTFgz3VG8b1nzxPw',
      host: 'imap.mail.ru',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.once('ready', () => {
      console.log('✅ IMAP подключен к Mail.ru');
      this.isConnected = true;
      this.startEmailPolling();
    });

    this.imap.once('error', (err) => {
      console.error('❌ IMAP ошибка:', err.message);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      console.log('📧 IMAP соединение закрыто');
      this.isConnected = false;
    });

    console.log('🔄 Подключаемся к IMAP...');
    this.imap.connect();
  }

  private async reconnectImap() {
    console.log('🔄 Переподключаемся к IMAP...');
    if (this.imap) {
      this.imap.end();
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 сек
    await this.setupImapConnection();
  }

  private startEmailPolling() {
    // Проверяем сразу при запуске
    this.checkForNewEmails();
    
    // Затем каждые 5 минут
    setInterval(async () => {
      try {
        await this.checkForNewEmails();
      } catch (error) {
        console.error('❌ Ошибка проверки почты:', error.message);
        await this.reconnectImap();
      }
    }, 300000);
  }

  public async checkForNewEmails() {
    if (!this.isConnected) {
      console.log('⚠️ IMAP не подключен, пропускаем проверку');
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(new Error(`Ошибка открытия INBOX: ${err.message}`));
          return;
        }

        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            reject(new Error(`Ошибка поиска писем: ${err.message}`));
            return;
          }
          
          if (results.length > 0) {
            console.log(`📨 Найдено новых писем: ${results.length}`);
            // Обрабатываем письма последовательно
            this.processEmailsSequentially(results)
              .then(resolve)
              .catch(reject);
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  private async processEmailsSequentially(uids: number[]) {
    for (const uid of uids) {
      await this.processEmail(uid);
    }
  }

  private async processEmail(uid: number) {
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
              
              this.imap.addFlags(uid, ['\\Seen'], (err) => {
                if (err) {
                  console.error('Ошибка пометки письма:', err);
                } else {
                  console.log('✅ Письмо помечено как прочитанное');
                }
                resolve(parsed);
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

  private async handleParsedEmail(parsedEmail: any) {
    console.log('📧 Обрабатываем письмо от:', parsedEmail.from?.value?.[0]?.address);
    
    if (!parsedEmail.attachments || parsedEmail.attachments.length === 0) {
      console.log('📭 Вложений нет, пропускаем');
      return;
    }

    console.log(`📎 ВСЕ вложения (${parsedEmail.attachments.length}):`);
    
    for (let i = 0; i < parsedEmail.attachments.length; i++) {
      const attachment = parsedEmail.attachments[i];
      console.log(`  ${i + 1}.`, {
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.content?.length || 'unknown'
      });
    }

    for (const attachment of parsedEmail.attachments) {
      await this.saveAttachment(attachment, parsedEmail);
    }
  }

  private async saveAttachment(attachment: any, email: any) {
    try {
      const attachmentsDir = '/email-attachments';  // ← Корень контейнера
      const filename = attachment.filename;
      const filePath = path.join(attachmentsDir, filename);

      await fs.promises.mkdir(attachmentsDir, { recursive: true });
      await fs.promises.writeFile(filePath, attachment.content);
      console.log('💾 Сохранен файл:', filename);

      const attachmentRecord = this.attachmentsRepo.create({
        filename: filename,
        email_from: email.from?.value?.[0]?.address,
        received_at: new Date(),
      });

      await this.attachmentsRepo.save(attachmentRecord);
      console.log('📝 Запись в БД:', filename);

    } catch (error) {
      console.error('❌ Ошибка сохранения вложения:', error);
    }
  }
}