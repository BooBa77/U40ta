import { IsEmail, IsString, Length, Matches } from 'class-validator';

/**
 * DTO для запроса кода подтверждения
 */
export class SendCodeDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;
}

/**
 * DTO для проверки кода
 */
export class VerifyCodeDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;

  @IsString()
  @Length(4, 4, { message: 'Код должен состоять из 4 цифр' })
  @Matches(/^\d{4}$/, { message: 'Код должен содержать только цифры' })
  code!: string;
}

/**
 * DTO для проверки статуса кода
 */
export class CheckCodeStatusDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;
}