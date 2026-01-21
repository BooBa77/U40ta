import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO для обновления статуса игнорирования
 * Используется в POST /api/statements/ignore
 */
export class UpdateIgnoreDto {
  @IsNumber()
  attachmentId: number;
  
  @IsString()
  invNumber: string;
  
  @IsString()
  @IsOptional()
  partyNumber?: string;
  
  @IsBoolean()
  isIgnore: boolean;
}