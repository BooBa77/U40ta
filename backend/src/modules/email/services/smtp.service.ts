import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpService {
  private transporter;

  constructor() {
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

  async sendEmail(to: string, subject: string, text: string, attachments?: any[]) {
    try {
      const result = await this.transporter.sendMail({
        from: '"U40TA System" <u40ta@mail.ru>',
        to,
        subject,
        text,
        attachments
      });
      
      console.log('✅ Email отправлен:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Ошибка отправки email:', error);
      return { success: false, error: error.message };
    }
  }
}