import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

@Injectable()
export class MailRuEmailService implements OnModuleInit {
  private transporter;
  private imap;

  constructor() {
    // Настройка отправки (SMTP)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.mail.ru',
      port: 465,
      secure: true,
      auth: {
        user: 'u40ta@mail.ru',
        pass: 'YxTNPTFgz3VG8b1nzxPw'
      }
    });
  }

  async onModuleInit() {
    await this.verifySMTP();
    this.setupImapReceiver();
  }

  private async verifySMTP() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP подключение к Mail.ru установлено');
    } catch (error) {
      console.error('❌ Ошибка SMTP подключения:', error);
    }
  }

  private setupImapReceiver() {
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
      this.startEmailPolling();
    });

    this.imap.once('error', (err) => {
      console.error('❌ IMAP ошибка:', err);
    });

    this.imap.once('end', () => {
      console.log('📧 IMAP соединение закрыто');
    });

    console.log('🔄 Подключаемся к IMAP...');
    this.imap.connect();
  }

  // Отправка Excel пользователю
  async sendExcelToUser(userEmail: string, excelBuffer: Buffer, reportName: string) {
    try {
      const result = await this.transporter.sendMail({
        from: '"U40TA Inventory System" <u40ta@mail.ru>',
        to: userEmail,
        subject: `📊 Excel отчет: ${reportName}`,
        text: `Отчет "${reportName}" во вложении.`,
        attachments: [
          {
            filename: `${reportName}.xlsx`,
            content: excelBuffer
          }
        ]
      });

      console.log('✅ Excel отправлен на:', userEmail);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Ошибка отправки:', error);
      return { success: false, error: error.message };
    }
  }

  // Периодическая проверка входящих писем
  private startEmailPolling() {
    // Проверяем сразу при запуске
    this.checkForNewEmails();
    
    // Затем каждые 5 минут
    setInterval(() => {
      this.checkForNewEmails();
    }, 300000);
  }

  private async checkForNewEmails() {
    try {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Ошибка открытия INBOX:', err);
          return;
        }

        // Ищем непрочитанные письма
        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('Ошибка поиска писем:', err);
            return;
          }
          
          if (results.length > 0) {
            console.log(`📨 Найдено новых писем: ${results.length}`);
            results.forEach(uid => this.processEmail(uid));
          }
        });
      });
    } catch (error) {
      console.error('Ошибка проверки почты:', error);
    }
  }

  private async processEmail(uid: number) {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(uid, { bodies: '' });
      
      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          
          stream.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer);
              await this.handleParsedEmail(parsed);
              
              // Помечаем как прочитанное
              this.imap.addFlags(uid, ['\\Seen'], (err) => {
                if (err) console.error('Ошибка пометки письма:', err);
                else console.log('✅ Письмо помечено как прочитанное');
              });
              
              resolve(parsed);
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
    console.log('📧 Обрабатываем письмо:');
    console.log('От:', parsedEmail.from?.value);
    console.log('Тема:', parsedEmail.subject);
    console.log('Дата:', parsedEmail.date);

    // Проверяем вложения
    if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
      console.log(`📎 Вложений: ${parsedEmail.attachments.length}`);
      
      for (const attachment of parsedEmail.attachments) {
        if (this.isExcelFile(attachment.filename)) {
          console.log('📊 Найден Excel файл:', attachment.filename);
          await this.processExcelAttachment(attachment);
        }
      }
    }
  }

  private isExcelFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.xlsx') || 
           filename.toLowerCase().endsWith('.xls');
  }

  private async processExcelAttachment(attachment: any) {
    try {
      console.log('🔧 Обрабатываем Excel файл:', attachment.filename);
      console.log('Размер файла:', attachment.content.length, 'bytes');
      
      // TODO: Добавить парсинг Excel и обновление БД
      
    } catch (error) {
      console.error('❌ Ошибка обработки Excel:', error);
    }
  }
}