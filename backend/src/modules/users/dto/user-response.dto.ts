import { Exclude, Expose } from 'class-transformer';

/**
 * DTO для безопасного ответа с данными пользователя
 * Исключает чувствительные данные если будут добавлены в будущем
 */
@Exclude()
export class UserResponseDto {
  @Expose() id!: number;
  @Expose() firstName!: string;
  @Expose() lastName!: string;
  @Expose() abr!: string;
  @Expose() eMail!: string;
}