import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { StatementsController } from './statements.controller';
import { StatementService } from './services/statement.service';
import { StatementParserService } from './services/statement-parser.service';
import { StatementObjectsService } from './services/statement-objects.service';
import { ProcessedStatement } from './entities/processed-statement.entity';
import { EmailAttachment } from '../email/entities/email-attachment.entity';
import { InventoryObject } from '../objects/entities/object.entity'; // Импорт сущности объектов

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessedStatement, // Для работы с таблицей активных ведомостей
      EmailAttachment, // Для работы с таблицей файлов почтовых вложений
      InventoryObject, // Для работы с таблицей объектов
    ]),
    AppEventsModule, // Для SSE уведомлений
    JwtAuthModule, // Для JAuthGuard    
  ],
  controllers: [StatementsController],
  providers: [StatementService, StatementParserService, StatementObjectsService],
  exports: [StatementService, StatementObjectsService],
})
export class StatementsModule {}