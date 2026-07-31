import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { MolController } from './mol.controller';
import { MolService } from './services/mol.service';
import { IgnoreKeywordsService } from './services/ignore-keywords.service';
import { InventoryObject } from '../objects/entities/object.entity';
import { Log } from '../logs/logs.entity';
import { IgnoreKeyword } from './entities/ignore-keyword.entity';

/**
 * Модуль инструментов МОЛа.
 * 
 * ## Назначение
 * - Экспорт объектов МОЛа в Excel (MolService)
 * - Управление игнор-словами для автоматической фильтрации ведомостей (IgnoreKeywordsService)
 * 
 * ## Глобальность
 * Модуль помечен как @Global(), чтобы IgnoreKeywordsService был доступен
 * в других модулях (например, в StatementParser) без явного импорта.
 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([InventoryObject, Log, IgnoreKeyword]),
        JwtAuthModule,
        EmailModule,
        UsersModule,
    ],
    controllers: [MolController],
    providers: [
        MolService,
        IgnoreKeywordsService,
    ],
    exports: [IgnoreKeywordsService],
})
export class MolModule {}