import { Controller, Get, UseGuards, Param, Req } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * UsersController - обрабатывает HTTP запросы связанные с пользователями системы
 * Все endpoints защищены JwtAuthGuard, который в режиме разработки автоматически пропускает запросы
 * а в продакшене требует валидный JWT токен
 */
interface RequestWithUser extends ExpressRequest {
  user?: {
    sub: number;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard) // Защищаем весь контроллер JWT аутентификацией
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users - возвращает список всех пользователей системы
   * В режиме разработки доступен без авторизации для выбора тестового пользователя
   * В продакшене требует валидный JWT токен
   * 
   * @returns Promise<User[]> - массив пользователей из таблицы users
   */
  @Get()
  async findAll() {
    // Вызываем сервис для получения всех пользователей из базы данных
    const users = await this.usersService.findAll();
    return users;
  }

  /**
   * GET /api/users/me/abr - возвращает аббревиатуру текущего пользователя
   */
  @Get('me/abr')
  async getMyAbr(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    
    if (!userId) {
      return { abr: null };
    }
    
    try {
      const user = await this.usersService.findById(userId);
      return { abr: user.abr };
    } catch (error) {
      // Если пользователь не найден (гость)
      return { abr: null };
    }
  }

  /**
   * GET /api/users/me/id - возвращает ID текущего пользователя
   */
  @Get('me/id')
  async getMyId(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    return { userId: userId || null };
  }

  /**
   * GET /api/users/me/has-access-to-statements/id - возвращает список доступных ведомостей
   */
  @Get('me/has-access-to-statements')
  async checkAccessToStatements(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    // Если userId нет (маловероятно, но TypeScript требует проверку)
    if (!userId) {
      return { hasAccessToStatements: false };
    }
    const hasAccess = await this.usersService.hasAccessToStatements(userId);
    return { hasAccessToStatements: hasAccess };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.usersService.findById(+id); // +id преобразует строку в число
  }

}