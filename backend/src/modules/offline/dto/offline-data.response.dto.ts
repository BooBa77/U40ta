import { InventoryObject } from '../../objects/entities/object.entity';
import { Place } from '../../places/entities/place.entity';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';

// Тип для истории изменений объектов (из основной БД)
interface ObjectChange {
  id: number;
  object_id: number;
  story_line: string;
  changed_at: Date;
  changed_by: number;
}

// Основной DTO с данными для офлайн-режима
export interface OfflineDataDto {
  objects: InventoryObject[];
  places: Place[];
  processed_statements: ProcessedStatement[];
  object_changes: ObjectChange[];
  qr_codes: QrCode[];
  meta: {
    userId: number;
    fetchedAt: string;
    totalObjects: number;
    totalPlaces: number;
    totalStatements: number;
    totalObjectChanges: number;
    totalQrCodes: number;
    accessibleSklads: number;
  };
}

// DTO для ответа API
export interface OfflineDataResponseDto {
  success: boolean;
  data: OfflineDataDto;
  message: string;
}