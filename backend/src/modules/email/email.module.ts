import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { LogsModule } from '../logs/logs.module';
import { EmailController } from './email.controller';
import { EmailAttachment } from './entities/email-attachment.entity';
import { MolAccess } from '../users/entities/mol-access.entity';
import { ImapService } from './services/imap.service';
import { SmtpService } from './services/smtp.service';
import { EmailProcessor } from './services/email-processor.service';
import { EmailFileAnalyzer } from './services/email-file-analyzer.service';
import { EmailAttachmentsService } from './services/email-attachments.service';
import { EmailStorageService } from './services/email-storage.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailAttachment, MolAccess]),
    AppEventsModule, // Модуль SSE
    JwtAuthModule,
    LogsModule,
  ],
  controllers: [EmailController],
  providers: [ImapService, SmtpService, EmailProcessor, EmailFileAnalyzer, EmailAttachmentsService, EmailStorageService],
  exports: [ImapService, SmtpService, EmailProcessor, EmailFileAnalyzer, EmailAttachmentsService, EmailStorageService]
})
export class EmailModule {}