import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { StatementsController } from './statements.controller';
import { StatementParserService } from './services/statement-parser.service';
import { ProcessedStatement } from './entities/processed-statement.entity';
import { EmailAttachment } from '../email/entities/email-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedStatement]),
    TypeOrmModule.forFeature([EmailAttachment,]), // Для работы с таблицей файлов почтовых вложений
    AppEventsModule, // Для SSE уведомлений
    JwtAuthModule, // Для JAuthGuard    
  ],
  controllers: [StatementsController],
  providers: [StatementParserService],
  exports: [StatementParserService]
})
export class StatementsModule {}