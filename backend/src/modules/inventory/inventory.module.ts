import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { InventoryStatement } from './entities/inventory-statement.entity';
import { InventoryController } from './inventory.controller';
import { InventoryStatementParser } from './services/inventory-statement-parser.service';
import { InventoryStatementsService } from './services/inventory-statements.service';
import { InventoryBooksService } from './services/inventory-books.service';

/**
 * Модуль инвентаризации.
 * 
 * ## Назначение
 * Обрабатывает инвентаризационные ведомости ревизоров:
 * - Приём Excel-файлов через EventEmitter из EmailModule
 * - Парсинг строк в inventory_statements
 * - Управление строками ведомостей (CRUD)
 * - Формирование сводных инвентаризационных ведомостей (inventory_books)
 * 
 * ## События
 * Слушает `inventory.file.received` от EmailModule.
 * Эмитит `inventory-statement-loaded` с ключом email для SSE-уведомления ревизора.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryStatement]),
    EventEmitterModule,
    JwtAuthModule,
    AppEventsModule,
  ],
  controllers: [InventoryController],
  providers: [
    InventoryStatementParser,
    InventoryStatementsService,
    InventoryBooksService,
  ],
})
export class InventoryModule {}