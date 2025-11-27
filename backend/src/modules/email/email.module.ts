import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ImapService } from './services/imap.service';
import { SmtpService } from './services/smtp.service';
import { EmailAttachment } from './entities/email-attachment.entity';
import { EmailController } from './email.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailAttachment]),
    JwtAuthModule,
  ],
  controllers: [EmailController],
  providers: [ImapService, SmtpService],
  exports: [ImapService, SmtpService]
})
export class EmailModule {}