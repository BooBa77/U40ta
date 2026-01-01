import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineService } from './services/offline.service';
import { OfflineCacheService } from './services/offline-cache.service';
import { OfflineDataService } from './services/offline-data.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { ObjectOfflineChange } from './entities/offline-object-change.entity';
import { ObjectsModule } from '../objects/objects.module';
import { PlacesModule } from '../places/places.module';
import { StatementsModule } from '../statements/statements.module';
import { ObjectChangesModule } from '../object_changes/object_changes.module';
import { QrCodesModule } from '../qr-codes/qr-codes.module';

@Module({
  imports: [
    // Регистрируем нашу собственную сущность для работы с временными оффлайн-изменениями
    TypeOrmModule.forFeature([ObjectOfflineChange]),
    
    // Импортируем внешние модули для доступа к их сервисам
    ObjectsModule,          // для работы с объектами (активами)
    PlacesModule,           // для работы с местами
    StatementsModule,       // для работы с ведомостями (с учетом mol_access)
    ObjectChangesModule,    // для чтения истории изменений (object_changes)
    QrCodesModule,          // для работы с QR-кодами
  ],
  controllers: [OfflineController],
  providers: [
    OfflineService,
    OfflineCacheService,
    OfflineDataService,
    OfflineSyncService,
  ],
  exports: [
    // Экспортируем основной сервис на случай, если другие модули захотят его использовать
    OfflineService,
  ],
})
export class OfflineModule {}