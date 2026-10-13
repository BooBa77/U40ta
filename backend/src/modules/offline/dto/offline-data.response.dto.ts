import { InventoryObject } from '../../objects/entities/object.entity';
import { Statement } from '../../statements/entities/statement.entity';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';
import { Photo } from '../../photos/entities/photos.entity';
import { InventoryBook } from '../../inventory/entities/inventory-book.entity';
import { InventoryBookItem } from '../../inventory/entities/inventory-book-item.entity';

export interface OfflineDataDto {
  objects: InventoryObject[];
  statements: Statement[];
  qr_codes: QrCode[];
  photos: Photo[];
  proposed_changes: any[];
  inventory_books: InventoryBook[];
  inventory_book_items: InventoryBookItem[];
  ignore_keywords: string[];
  meta: {
    userId: number;
    fetchedAt: string;
    totalStatements: number;
    totalObjects: number;
    totalQrCodes: number;
    totalPhotos: number;
    totalProposedChanges: number;
    totalInventoryBooks: number;
    totalInventoryBookItems: number;
    totalIgnoreKeywords: number;
  };
}

export class OfflineDataResponseDto {
  success!: boolean;
  data!: OfflineDataDto;
  message?: string;
}