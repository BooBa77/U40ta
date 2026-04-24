import { IsInt, IsString, IsOptional, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PhotoToAddDto {
  @IsString()
  max!: string;  // base64 полноразмерного фото 800x800

  @IsString()
  min!: string;  // base64 миниатюры 150x150
}

export class CreateObjectDto {
  @IsInt()
  zavod!: number;

  @IsString()
  @MaxLength(8)
  sklad!: string;

  @IsString()
  @MaxLength(255)
  buhName!: string;

  @IsString()
  @MaxLength(255)
  invNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  partyNumber?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sn?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeTer?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placePos?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeCab?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeUser?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  qrCodes?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoToAddDto)
  @IsOptional()
  photosToAdd?: PhotoToAddDto[];
}