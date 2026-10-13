import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { errorMessage, errorStack } from '../../../common/utils/error';

@Injectable()
export class SmtpService {
  private transporter;
  private readonly logger = new Logger(SmtpService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('email.smtp.host')!,
      port: this.configService.get('email.smtp.port')!,
      secure: this.configService.get('email.smtp.secure'),
      auth: {
        user: this.configService.get('email.smtp.user')!,
        pass: this.configService.get('email.smtp.password')!,
      },
    });      
  }

  async sendEmail(to: string, subject: string, text: string, attachments?: any[]) {
    try {
      const from = this.configService.get<string>('email.smtp.from')!;
      
      const result = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        attachments
      });
      
      this.logger.log('Email отправлен:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Ошибка отправки email: ${errorMessage(error)}`, errorStack(error));
      return { success: false, error: errorMessage(error) };
    }
  }
}