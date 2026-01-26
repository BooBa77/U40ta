import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateObjectDto {
  @IsOptional()
  @IsString()
  sn?: string;

  @IsOptional()
  @IsString()
  commentary?: string;

  @IsOptional()
  @IsString()
  place_ter?: string;

  @IsOptional()
  @IsString()
  place_pos?: string;

  @IsOptional()
  @IsString()
  place_cab?: string;

  @IsOptional()
  @IsString()
  place_user?: string;

  @IsOptional()
  @IsDateString() // формат YYYY-MM-DD
  checked_at?: string;
}