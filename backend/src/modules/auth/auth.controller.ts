import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * AuthController - обрабатывает запросы аутентификации и авторизации
 * Все endpoints защищены JwtAuthGuard, который в режиме разработки автоматически пропускает запросы
 * а в продакшене требует валидный JWT токен
 */
@Controller('auth')
@UseGuards(JwtAuthGuard) // Защищаем весь контроллер JWT аутентификацией
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/telegram - обработка авторизации через Telegram Web App
   * Принимает данные от Telegram Widget, проверяет пользователя и возвращает JWT токен
   * для одобренных пользователей или статус pending для ожидающих одобрения
   * 
   * @param telegramData - данные пользователя от Telegram Web App
   * @returns объект с статусом авторизации и JWT токеном при успехе
   */
  @Post('telegram')
  async telegramLogin(@Body() telegramData: any) {
    this.logger.log(`Получен запрос на авторизацию через Telegram для пользователя: ${telegramData.first_name}`);

    // Передаем все данные в AuthService для обработки
    // AuthService сам решит: одобрен пользователь или ожидает рассмотрения
    const result = await this.authService.telegramLogin(telegramData);
    
    // Логируем результат авторизации
    if (result.status === 'success') {
      this.logger.log(`Успешная авторизация пользователя: ${telegramData.first_name}`);
      this.logger.debug(`JWT токен сгенерирован`);
    } else {
      this.logger.log(`Пользователь ожидает одобрения: ${telegramData.first_name}`);
    }
    
    return result;
  }

  /**
   * POST /api/auth/dev-login - эндпоинт для авторизации в режиме разработки
   * Позволяет войти под любым пользователем из базы данных по его ID
   * В режиме разработки доступен без авторизации, в продакшене требует JWT токен
   * 
   * @param userId - объект с ID пользователя из тела запроса
   * @returns объект с статусом авторизации и JWT токеном
   */
  @Post('dev-login')
  async devLogin(@Body() { userId }: { userId: number }) {
    this.logger.log(`Получен запрос на dev-авторизацию для пользователя ID: ${userId}`);
    
    // Вызываем AuthService для обработки dev-логина
    const result = await this.authService.devLogin(userId);
    
    this.logger.log(`Dev-авторизация завершена для пользователя ID: ${userId}`);
    return result;
  }
}