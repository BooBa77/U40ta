import { IsInt, IsString, IsOptional, MaxLength, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class PhotoToAddDto {
  @IsString()
  max!: string;

  @IsString()
  min!: string;
}

export class UpdateObjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeTer?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placePos?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeCab?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeUser?: string;

  @IsDateString()
  @IsOptional()
  checkedAt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  qrCodes?: string[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  photosToDelete?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoToAddDto)
  @IsOptional()
  photosToAdd?: PhotoToAddDto[];
}