import { IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncObjectDto } from './sync-object.dto';
import { SyncInventoryBookItemDto } from './sync-inventory-book-item.dto';

/*
export class SyncChangesRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncObjectDto)
  changes!: SyncObjectDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncInventoryBookItemDto)
  @IsOptional()
  inventoryBookItemChanges?: SyncInventoryBookItemDto[];
}
*/
export class SyncChangesRequestDto {
  changes!: any[];
  inventoryBookItemChanges?: any[];
}