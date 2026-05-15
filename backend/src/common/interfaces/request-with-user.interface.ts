import { Request } from 'express';

/**
 * Расширенный Request с данными пользователя из JWT-токена.
 * Поле user добавляется JwtAuthGuard после проверки токена.
 */
export interface RequestWithUser extends Request {
  user: {
    sub: number;   // ID пользователя
    email?: string; // Email пользователя
  };
}