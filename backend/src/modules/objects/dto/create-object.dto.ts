import { IsInt, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateObjectDto {
  @IsInt()
  zavod: number;

  @IsString()
  @MaxLength(4)
  sklad: string;

  @IsString()
  @MaxLength(255)
  buh_name: string;

  @IsString()
  @MaxLength(255)
  inv_number: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  party_number?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sn?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  place_ter?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  place_pos?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  place_cab?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  place_user?: string | null;
}