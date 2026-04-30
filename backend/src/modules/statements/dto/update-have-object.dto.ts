/**
 * DTO для обновления статуса игнорирования
 * Используется в POST /api/statements/update-have-object
 */
import { IsInt, IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateHaveObjectDto {
  @IsInt()
  statementId!: number;

  @IsBoolean()
  @IsNotEmpty()
  haveObject!: boolean;  
}