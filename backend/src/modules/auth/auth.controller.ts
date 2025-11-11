import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { ConfigService } from '@nestjs/config';

/**
 * AuthController - обрабатывает запросы аутентификации и авторизации
 * Все endpoints публичные и не защищены JwtAuthGuard
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,) {}

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
   
   * @param userId - объект с ID пользователя из тела запроса
   * @returns объект с статусом авторизации и JWT токеном
   */
  @Post('dev-login')
  async devLogin(@Body() { userId }: { userId: number }) {
    // проверка на PRODUCTION, там эту дыру нужно контроллировать
    if (this.configService.get('NODE_ENV') === 'production') {
      this.logger.warn('Попытка использования dev-login в продакшене');
      throw new NotFoundException('Метод не найден');
    }

    this.logger.log(`Получен запрос на dev-авторизацию для пользователя ID: ${userId}`);
    const result = await this.authService.devLogin(userId);
    this.logger.log(`Dev-авторизация завершена для пользователя ID: ${userId}`);
    return result;
  }
}
