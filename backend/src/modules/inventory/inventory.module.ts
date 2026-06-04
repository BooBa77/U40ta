import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { InventoryStatement } from './entities/inventory-statement.entity';
import { InventoryBook } from './entities/inventory-book.entity';
import { InventoryBookItem } from './entities/inventory-book-item.entity';
import { RevisorAccess } from './entities/revisor-access.entity';
import { InventoryController } from './inventory.controller';
import { InventoryStatementParser } from './services/inventory-statement-parser.service';
import { InventoryStatementsService } from './services/inventory-statements.service';
import { InventoryBooksService } from './services/inventory-books.service';
import { RevisorAccessService } from './services/revisor-access.service';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

/**
 * Модуль инвентаризации.
 * 
 * ## Назначение
 * Обрабатывает инвентаризационные ведомости ревизоров:
 * - Приём Excel-файлов через EventEmitter из EmailModule
 * - Парсинг строк в inventory_statements
 * - Управление строками ведомостей (CRUD)
 * - Формирование сводных инвентаризационных ведомостей (inventory_books)
 * - Управление доступом ревизоров к книгам (revisor_access)
 * 
 * ## События
 * Слушает `inventory.file.received` от EmailModule.
 * Эмитит `inventory-statement-loaded` с ключом email для SSE-уведомления ревизора.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryStatement,
      InventoryBook,
      InventoryBookItem,
      RevisorAccess,
    ]),
    EventEmitterModule,
    JwtAuthModule,
    AppEventsModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [InventoryController],
  providers: [
    InventoryStatementParser,
    InventoryStatementsService,
    InventoryBooksService,
    RevisorAccessService,
  ],
})
export class InventoryModule {}