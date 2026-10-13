/* Отключено из-за проблем с валидацией на уровне транзакции
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
  proposedChangeActions?: any[];
  ignoreKeywords?: string[]; // полная замена списка игнор-слов
}