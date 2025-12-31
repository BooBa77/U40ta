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
    this.logger.log(`=== telegramLogin START ===`);
    this.logger.log(`loginData: ${JSON.stringify(loginData)}`);
    this.logger.log(`loginData.id (telegram_id): ${loginData.id}`);

    // 1. Сначала создаем/находим запись в telegram_users
    this.logger.log(`Вызываем telegramAuthService.createOrFind...`);
    const telegramAuthResult = await this.telegramAuthService.createOrFind(loginData);
    this.logger.log(`telegramAuthResult: ${JSON.stringify(telegramAuthResult)}`);
    this.logger.log(`telegram_users.id: ${telegramAuthResult.user.id}`);

    // 2. Ищем пользователя в users по telegram_users_id
    this.logger.log(`Ищем пользователя в users по telegram_users_id = ${telegramAuthResult.user.id}`);
    const approvedUser = await this.usersService.findByTelegramUsersId(telegramAuthResult.user.id);
    this.logger.log(`approvedUser: ${JSON.stringify(approvedUser)}`);

    if (approvedUser) {
      this.logger.log(`Пользователь одобрен: ${approvedUser.firstName}`);
      const token = await this.generateJwtToken(approvedUser);
      this.logger.log(`=== telegramLogin SUCCESS ===`);
      return {
        status: 'success',
        access_token: token
      };
    }

    this.logger.log(`Пользователь НЕ найден в таблице users`);
    this.logger.log(`=== telegramLogin PENDING ===`);
    return { status: 'pending' };
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