import { IsString, IsOptional, MaxLength, IsArray, IsInt } from 'class-validator';

export class UpdateInventoryBookDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  itemIds?: number[];
}