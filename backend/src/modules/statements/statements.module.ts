import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './services/statements.service';
import { StatementParser } from './services/statement-parser.service';
import { Statement } from './entities/statement.entity';
import { InventoryObject } from '../objects/entities/object.entity';

/**
 * Модуль ведомостей МОЛ.
 * 
 * ## Назначение
 * Обрабатывает ведомости МОЛ, полученные по email:
 * - Приём Excel-файлов через EventEmitter из EmailModule
 * - Парсинг строк в таблицу statements
 * - Управление ведомостями (CRUD)
 * - Обновление флагов haveObject, isActual, isExcess
 * 
 * ## События
 * Слушает `statement.file.received` от EmailModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Statement,
      InventoryObject,
    ]),
    JwtAuthModule,
  ],
  controllers: [StatementsController],
  providers: [
    StatementsService,
    StatementParser,
  ],
})
export class StatementsModule {}