import { EmailAttachment } from 'src/modules/email/entities/email-attachment.entity';
import { InventoryObject } from 'src/modules/objects/entities/object.entity';
import { ProcessedStatement } from 'src/modules/statements/entities/processed-statement.entity';
import { QrCode } from 'src/modules/qr-codes/entities/qr-code.entity';
import { Photo } from 'src/modules/photos/entities/photos.entity';

// Основной DTO с данными для офлайн-режима
export interface OfflineDataDto {
  objects: InventoryObject[];
  email_attachments: EmailAttachment[];
  processed_statements: ProcessedStatement[];
  qr_codes: QrCode[];
  photos: Photo[];
  meta: {
    userId: number;
    fetchedAt: string;
    totalObjects: number;
    totalObjectsInStatements: number;
    totalQrCodes: number;
    totalPhotos: number;
    accessibleSklads: number;
  };
}

// DTO для ответа API
export class OfflineDataResponseDto {
  success: boolean;
  data: OfflineDataDto;
  message: string;
}