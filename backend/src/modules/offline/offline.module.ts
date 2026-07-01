import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineService } from './services/offline.service';
import { OfflineCacheService } from './services/offline-cache.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { InventoryObject } from '../objects/entities/object.entity';
import { Statement } from '../statements/entities/statement.entity';
import { QrCode } from '../qr-codes/entities/qr-code.entity';
import { Photo } from '../photos/entities/photos.entity';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MolAccess } from '../users/entities/mol-access.entity';
import { ObjectsModule } from '../objects/objects.module';
import { StatementsModule } from '../statements/statements.module';
import { QrCodesModule } from '../qr-codes/qr-codes.module';
import { PhotosModule } from '../photos/photos.module';
import { InventoryBook } from '../inventory/entities/inventory-book.entity';
import { InventoryBookItem } from '../inventory/entities/inventory-book-item.entity';
import { RevisorAccess } from '../inventory/entities/revisor-access.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ProposedChange } from '../proposed-changes/entities/proposed-change.entity';
import { ProposedChangesModule } from '../proposed-changes/proposed-changes.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MolAccess,
      Statement,
      InventoryObject,
      QrCode,
      Photo,
      InventoryBook,
      InventoryBookItem,
      RevisorAccess,
      ProposedChange,
    ]),
    JwtAuthModule,
    UsersModule,
    StatementsModule,
    ObjectsModule,
    QrCodesModule,
    PhotosModule,
    InventoryModule,
    ProposedChangesModule,
  ],
  controllers: [OfflineController],
  providers: [
    OfflineService,
    OfflineCacheService,
    OfflineSyncService,
  ],
  exports: [
    OfflineService,
  ],
})
export class OfflineModule {}