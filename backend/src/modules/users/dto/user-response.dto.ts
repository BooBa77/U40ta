import { Exclude } from 'class-transformer';

/**
 * DTO для безопасного ответа с данными пользователя
 * Исключает чувствительные данные если будут добавлены в будущем
 */
export class UserResponseDto {
  id: number;
  telegramUsersId: number;
  firstName: string;
  lastName: string;
  abr: string;
  createdAt: Date;
}