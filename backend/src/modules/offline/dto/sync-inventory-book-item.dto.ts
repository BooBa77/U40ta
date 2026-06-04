import { IsInt, IsBoolean, IsString, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class SyncLogDto {
  source!: string;
  time!: string;
  content: any;
}

export class SyncInventoryBookItemDto {
  @IsInt()
  idInventoryStatement!: number;

  @IsInt()
  @IsOptional()
  idObject?: number | null;

  @IsString()
  @IsOptional()
  placeTer?: string | null;

  @IsString()
  @IsOptional()
  placePos?: string | null;

  @IsString()
  @IsOptional()
  placeCab?: string | null;

  @IsString()
  @IsOptional()
  placeUser?: string | null;

  @IsBoolean()
  @IsOptional()
  isOkManual?: boolean;

  @IsBoolean()
  @IsOptional()
  isOkAuto?: boolean;

  @IsString()
  @IsOptional()
  dateOkManualChecked?: string | null;

  @IsString()
  @IsOptional()
  dateOkAutoChecked?: string | null;

  @IsString()
  @IsOptional()
  rem?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncLogDto)
  @IsOptional()
  logs?: SyncLogDto[];
}