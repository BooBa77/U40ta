import { IsNumber, IsString, IsOptional, IsEmail } from 'class-validator';

/**
 * DTO для создания пользователя системы
 * Создается при авторизации через Telegram или Email
 * Поле abr генерируется в сервисе на основе first_name и last_name
 */
export class CreateUserDto {
  @IsNumber()
  telegramUsersId!: number;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный формат email' })
  eMail?: string;
}