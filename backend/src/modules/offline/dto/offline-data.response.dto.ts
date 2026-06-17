import { InventoryObject } from 'src/modules/objects/entities/object.entity';
import { Statement } from 'src/modules/statements/entities/statement.entity';
import { QrCode } from 'src/modules/qr-codes/entities/qr-code.entity';
import { Photo } from 'src/modules/photos/entities/photos.entity';
import { InventoryBook } from 'src/modules/inventory/entities/inventory-book.entity';
import { InventoryBookItem } from 'src/modules/inventory/entities/inventory-book-item.entity';

export interface OfflineDataDto {
  objects: InventoryObject[];
  statements: Statement[];
  qr_codes: QrCode[];
  photos: Photo[];
  inventory_books: InventoryBook[];
  inventory_book_items: InventoryBookItem[];
  meta: {
    userId: number;
    fetchedAt: string;
    totalStatements: number;
    totalObjects: number;
    totalQrCodes: number;
    totalPhotos: number;
    totalInventoryBooks: number;
    totalInventoryBookItems: number;
  };
}

export class OfflineDataResponseDto {
  success!: boolean;
  data!: OfflineDataDto;
  message?: string;
}