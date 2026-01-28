import { IsNumber, IsString, IsOptional, Min, IsNotEmpty } from 'class-validator';

/**
 * DTO для данных авторизации от Telegram Widget
 * Содержит все поля которые отправляет Telegram
 */
export class TelegramLoginDto {
  @IsNumber()
  @Min(1)
  id: number;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsNumber()
  @Min(1)
  auth_date: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}