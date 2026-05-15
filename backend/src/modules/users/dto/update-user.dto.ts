import { IsOptional, IsString, IsEmail } from 'class-validator';

/**
 * DTO для обновления данных пользователя из админки
 * Все поля опциональные — обновляется только то, что передано
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  eMail?: string;
}