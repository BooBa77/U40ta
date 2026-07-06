import { Controller, Get, UseGuards, Param, Req, UnauthorizedException } from '@nestjs/common';
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
   * GET /api/users/me/mol-access — получение складов, доступных текущему МОЛу.
   * Возвращает массив доступных { zavod, sklad } из таблицы mol_access.
   */
  @Get('me/mol-access')
  async getMyMolAccess(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    return this.usersService.getMolAccess(userId);
  }

  /**
   * GET /api/users/me/has-access-to-sklad/:zavod/:sklad - проверка доступа к складу
   */
  @Get('me/has-access-to-sklad/:zavod/:sklad')
  async checkHasAccessToSklad(
    @Req() request: RequestWithUser,
    @Param('zavod') zavod: string,
    @Param('sklad') sklad: string,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      return { canEdit: false };
    }
    const canEdit = await this.usersService.hasAccessToSklad(userId, +zavod, sklad);
    return { canEdit };
  }

  /**
   * GET /api/users/me/has-access-to-statements/id - возвращает список доступных ведомостей
   */
  @Get('me/has-access-to-statements')
  async checkAccessToStatements(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    // Если userId нет (невероятно, но TypeScript требует проверку)
    if (!userId) {
      return { hasAccessToStatements: false };
    }
    const hasAccess = await this.usersService.hasAccessToStatements(userId);
    return { hasAccessToStatements: hasAccess };
  }

  /**
   * GET /api/users/me/is-revisor — проверяет, является ли текущий пользователь ревизором
   */
  @Get('me/is-revisor')
  async checkIsRevisor(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    
    if (!userId) {
      return { isRevisor: false };
    }
    
    const isRevisor = await this.usersService.isRevisor(userId);
    return { isRevisor };
  }  

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.usersService.findById(+id); // +id преобразует строку в число
  }

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