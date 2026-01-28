import { IsNumber, IsString, IsOptional } from 'class-validator';

/**
 * DTO для создания записи о пользователе Telegram
 * Используется при первой авторизации через Telegram Widget
 */
export class CreateTelegramUserDto {
  @IsNumber()
  telegram_id: number;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;
}