import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TelegramAuthService } from './telegram-auth.service';
import { UsersService } from '../../users/users.service';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private telegramAuthService: TelegramAuthService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}


  /**
   * Авторизация в режиме разработки
   * Пользователя выбираем из списка на странице DevLogin.vue
   */
  async devLogin(userId: number) {
    const user = await this.usersService.findById(userId);;
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    
    const token = await this.generateJwtToken(user);
    return {
      status: 'success',
      access_token: token
    };
  }

  /**
   * Основной метод обработки Telegram авторизации
   * Проверяет пользователя в основной таблице и возвращает соответствующий результат
   * Для одобренных пользователей генерирует JWT токен
   */
  async telegramLogin(loginData: any) {
    this.logger.log(`Начало обработки Telegram логина для пользователя: ${loginData.first_name}`);

    // Проверяем есть ли пользователь в таблице одобренных пользователей
    // Используем UsersService для поиска по telegram_id
    const approvedUser = await this.usersService.findByTelegramUsersId(loginData.id);
    
    if (approvedUser) {
      this.logger.log(`Пользователь одобрен, начинаем генерацию JWT: ${approvedUser.firstName}`);
      
      // Генерируем JWT токен для одобренного пользователя
      const token = await this.generateJwtToken(approvedUser);
      
      this.logger.log(`JWT токен успешно сгенерирован для пользователя: ${approvedUser.firstName}`);
      
      // Возвращаем успешный результат с JWT токеном
      return {
        status: 'success',
        access_token: token
      };
    }

    this.logger.log(`Пользователь не найден в одобренных, проверяем заявки для Telegram ID: ${loginData.id}`);
    
    // Если пользователь не одобрен, работаем с заявками через TelegramAuthService
    const { user: telegramUser, isNew } = await this.telegramAuthService.createOrFind(loginData);
    
    this.logger.log(`Обработка заявки завершена, пользователь: ${telegramUser.first_name}, новая заявка: ${isNew}`);
    
    // Для непринятых пользователей возвращаем статус pending без JWT токена
    return {
      status: 'pending'
    };
  }

  /**
   * Генерация JWT токена для одобренного пользователя
   * Создает payload с основными данными пользователя и подписывает токен
   * 
   * @param user - объект одобренного пользователя из базы данных
   * @returns Promise<string> - JWT токен
   */
  private async generateJwtToken(user: any): Promise<string> {
    this.logger.log(`Начало генерации JWT токена для пользователя ID: ${user.id}`);
    
    // Создаем payload JWT токена с основными данными пользователя
    // Эти данные будут доступны при верификации токена без запроса к базе данных
    const payload = {
      sub: user.id,                            // Внутренний ID пользователя в нашей системе
      role: user.role,                         // Роль пользователя (user/admin)
    };

    this.logger.debug(`Сгенерирован payload для JWT: ${JSON.stringify(payload)}`);
    
    // Генерируем JWT токен с использованием JwtService из @nestjs/jwt
    // JwtService автоматически использует настройки из JwtModule.register()
    const token = this.jwtService.sign(payload);
    
    this.logger.log(`JWT токен успешно сгенерирован, длина токена: ${token.length} символов`);
    
    return token;
  }
}