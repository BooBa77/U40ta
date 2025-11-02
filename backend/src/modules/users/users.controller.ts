import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * UsersController - обрабатывает HTTP запросы связанные с пользователями системы
 * Все endpoints защищены JwtAuthGuard, который в режиме разработки автоматически пропускает запросы
 * а в продакшене требует валидный JWT токен
 */
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
}