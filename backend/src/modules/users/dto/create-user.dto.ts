import { IsNumber, IsString } from 'class-validator';

/**
 * DTO для создания пользователя системы
 * Создается при первой авторизации через Telegram
 * Поле abr генерируется в сервисе на основе first_name и last_name
 */
export class CreateUserDto {
  @IsNumber()
  telegramUsersId: number;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  abr: string; // Формат: первая буква имени + первая буква фамилии
}