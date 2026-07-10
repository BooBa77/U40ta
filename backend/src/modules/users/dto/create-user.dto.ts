import { IsNumber, IsString, IsNotEmpty, IsEmail } from 'class-validator';

/**
 * DTO для создания пользователя системы
 * Создается при авторизации через Telegram или Email
 * Поле abr генерируется в сервисе на основе first_name и last_name
 */
export class CreateUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail({}, { message: 'Некорректный формат email' })
  @IsNotEmpty({ message: 'Email обязателен' })
  eMail!: string;
}