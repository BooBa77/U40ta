import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineService } from './services/offline.service';
import { OfflineCacheService } from './services/offline-cache.service';
import { OfflineDataService } from './services/offline-data.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { ObjectOfflineHistory } from './entities/offline-object-history.entity';
import { InventoryObject } from '../objects/entities/object.entity';
import { ProcessedStatement } from '../statements/entities/processed-statement.entity';
//import { ObjectHistory } from '../object_history/entities/object_history.entity';
import { QrCode } from '../qr-codes/entities/qr-code.entity';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MolAccess } from '../users/entities/mol-access.entity';
import { ObjectsModule } from '../objects/objects.module';
import { StatementsModule } from '../statements/statements.module';
//import { ObjectHistoryModule } from '../object_history/object_history.module';
import { QrCodesModule } from '../qr-codes/qr-codes.module';


@Module({
  imports: [
    // Регистрируем ВСЕ необходимые сущности
    TypeOrmModule.forFeature([
      ObjectOfflineHistory,
      InventoryObject,
      ProcessedStatement,
      //ObjectHistory,
      QrCode,
      MolAccess,
    ]),
    
    // Импортируем внешние модули для доступа к их сервисам
    JwtAuthModule,
    ObjectsModule,
    StatementsModule,
    //ObjectHistoryModule,
    QrCodesModule,
  ],
  controllers: [OfflineController],
  providers: [
    OfflineService,
    OfflineCacheService,
    OfflineDataService,
    OfflineSyncService,
  ],
  exports: [
    OfflineService,
  ],
})
export class OfflineModule {}