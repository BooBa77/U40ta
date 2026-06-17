import { IsString, IsBoolean, IsDateString } from 'class-validator';

/**
 * DTO для обновления статуса актуальности группы строк ведомости.
 * POST /api/statements/update-actual
 */
export class UpdateActualDto {
  /** Дата получения ведомости (идентифицирует ведомость) */
  @IsDateString()
  receivedAt!: string;

  /** Инвентарный номер */
  @IsString()
  invNumber!: string;

  /** Новое значение актуальности */
  @IsBoolean()
  isActual!: boolean;
}