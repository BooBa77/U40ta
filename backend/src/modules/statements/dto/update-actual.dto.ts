import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO для обновления статуса игнорирования
 * Используется в POST /api/statements/update-actual
 */
export class UpdateActualDto {
  @IsNumber()
  attachmentId!: number;
  
  @IsString()
  invNumber!: string;
  
  @IsBoolean()
  isActual!: boolean;
}