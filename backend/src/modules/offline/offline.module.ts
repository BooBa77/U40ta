import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineService } from './services/offline.service';
import { OfflineCacheService } from './services/offline-cache.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { InventoryObject } from '../objects/entities/object.entity';
import { ProcessedStatement } from '../statements/entities/processed-statement.entity';
import { QrCode } from '../qr-codes/entities/qr-code.entity';
import { Photo } from '../photos/entities/photos.entity';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MolAccess } from '../users/entities/mol-access.entity';
import { EmailAttachment } from '../email/entities/email-attachment.entity';
import { EmailModule } from '../email/email.module';
import { ObjectsModule } from '../objects/objects.module';
import { StatementsModule } from '../statements/statements.module';
import { QrCodesModule } from '../qr-codes/qr-codes.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [
    // Регистрируем ВСЕ необходимые сущности
    TypeOrmModule.forFeature([
      MolAccess,
      EmailAttachment,
      InventoryObject,
      ProcessedStatement,
      QrCode,
      Photo,
    ]),
    
    // Импортируем внешние модули для доступа к их сервисам
    JwtAuthModule,
    EmailModule,    
    StatementsModule,
    ObjectsModule,
    QrCodesModule,
    PhotosModule
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