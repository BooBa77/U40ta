// app/src/modules/offline/offline.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineService } from './services/offline.service';
import { OfflineCacheService } from './services/offline-cache.service';
import { OfflineDataService } from './services/offline-data.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { ObjectOfflineChange } from './entities/offline-object-change.entity';
import { InventoryObject } from '../objects/entities/object.entity';
import { Place } from '../places/entities/place.entity';
import { ProcessedStatement } from '../statements/entities/processed-statement.entity';
import { ObjectChange } from '../object_changes/entities/object-change.entity';
import { QrCode } from '../qr-codes/entities/qr-code.entity';
import { MolAccess } from '../statements/entities/mol-access.entity';
import { ObjectsModule } from '../objects/objects.module';
import { PlacesModule } from '../places/places.module';
import { StatementsModule } from '../statements/statements.module';
import { ObjectChangesModule } from '../object_changes/object_changes.module';
import { QrCodesModule } from '../qr-codes/qr-codes.module';

@Module({
  imports: [
    // Регистрируем все необходимые сущности (убрали MolAccess)
    TypeOrmModule.forFeature([
      ObjectOfflineChange,
      InventoryObject,
      Place,
      ProcessedStatement,
      ObjectChange,
      QrCode,
    ]),
    
    // Импортируем внешние модули
    ObjectsModule,
    PlacesModule,
    StatementsModule,
    ObjectChangesModule,
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