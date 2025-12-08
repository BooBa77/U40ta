import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module'; // SSE
import { ImapService } from './services/imap.service';
import { SmtpService } from './services/smtp.service';
import { EmailProcessor } from './services/email-processor.service';
import { EmailFileAnalyzer } from './services/email-file-analyzer.service';
import { EmailAttachment } from './entities/email-attachment.entity';
import { ProcessedStatement } from './entities/processed-statement.entity';
import { EmailController } from './email.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailAttachment, ProcessedStatement]),
    AppEventsModule, // Модуль SSE
    JwtAuthModule,
  ],
  controllers: [EmailController],
  providers: [ImapService, SmtpService, EmailProcessor, EmailFileAnalyzer],
  exports: [ImapService, SmtpService, EmailProcessor, EmailFileAnalyzer]
})
export class EmailModule {}