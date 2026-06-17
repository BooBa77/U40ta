import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { LogsModule } from '../logs/logs.module';
import { UsersModule } from '../users/users.module';
import { EmailController } from './email.controller';
import { ImapService } from './services/imap.service';
import { SmtpService } from './services/smtp.service';
import { EmailProcessor } from './services/email-processor.service';
import { EmailFileAnalyzer } from './services/email-file-analyzer.service';

/**
 * Модуль электронной почты.
 * 
 * ## Назначение
 * Приём писем по IMAP, извлечение Excel-вложений, анализ и передача
 * в соответствующие модули:
 * - Обычные ведомости → statements-модуль (событие statement.file.received)
 * - Инвентаризационные ведомости → inventory-модуль (событие inventory.file.received)
 * 
 * Файлы не сохраняются на диск, записи в email_attachments не создаются.
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    JwtAuthModule,
    LogsModule,
    UsersModule, // Для поиска пользователя по email в EmailProcessor
  ],
  controllers: [EmailController],
  providers: [
    ImapService,
    SmtpService,
    EmailProcessor,
    EmailFileAnalyzer,
  ],
  exports: [ImapService, SmtpService],
})
export class EmailModule {}