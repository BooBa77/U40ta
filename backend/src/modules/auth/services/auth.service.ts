import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TelegramAuthService } from './telegram-auth.service';
import { UsersService } from '../../users/users.service';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private telegramAuthService: TelegramAuthService,
    private usersService: UsersService,
    private telegramUsersService: TelegramUsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Авторизация в режиме разработки
   * Пользователя выбираем из списка на странице DevLogin.vue
   * Оставляем без изменений для обратной совместимости
   */
  async devLogin(userId: number): Promise<AuthResponseDto> {
    this.logger.log(`Dev-авторизация для пользователя ID: ${userId}`);
    
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    
    const token = await this.generateJwtToken(user);
    
    this.logger.log(`Dev-авторизация успешна для пользователя: ${user.firstName}`);
    return { access_token: token };
  }

  /**
   * Основной метод обработки Telegram авторизации
   * В НОВОЙ системе ВСЕГДА создает/находит пользователя и возвращает токен
   * НЕТ состояния "ожидания одобрения" - все становятся гостями
   */
  async telegramLogin(loginData: any): Promise<AuthResponseDto> {
    this.logger.log(`=== Telegram авторизация START ===`);
    this.logger.log(`Данные от Telegram: ${JSON.stringify({
      id: loginData.id,
      first_name: loginData.first_name,
      last_name: loginData.last_name
    })}`);

    // 1. Обрабатываем данные Telegram (находим или создаем в telegram_users)
    const telegramAuthResult = await this.telegramAuthService.processTelegramData(loginData);
    this.logger.log(`Пользователь Telegram: ID ${telegramAuthResult.user.id}, новый: ${telegramAuthResult.isNew}`);

    // 2. Находим или создаем пользователя в основной таблице users
    const user = await this.usersService.findOrCreate(
      telegramAuthResult.user.id, // telegram_users.id передаем как telegramUsersId
      loginData.first_name,
      loginData.last_name || ''
    );
    
    this.logger.log(`Пользователь системы: ID ${user.id}, abr: ${user.abr}`);

    // 3. Генерируем JWT токен для пользователя
    const token = await this.generateJwtToken(user);
    
    this.logger.log(`=== Telegram авторизация SUCCESS ===`);
    this.logger.log(`Токен сгенерирован для пользователя: ${user.firstName} ${user.lastName}`);
    
    return { access_token: token };
  }

  /**
   * Генерация JWT токена для пользователя
   * В payload включаем основные данные для работы фронтенда
   */
  private async generateJwtToken(user: any): Promise<string> {
    this.logger.log(`Генерация JWT токена для пользователя ID: ${user.id}`);
    
    // Payload JWT токена
    const payload = {
      sub: user.id,                    // Внутренний ID пользователя
      abr: user.abr,                   // Аббревиатура для подписей
      firstName: user.firstName,       // Имя пользователя
      lastName: user.lastName,         // Фамилия пользователя
      telegramUsersId: user.telegramUsersId, // Ссылка на telegram_users
    };

    this.logger.debug(`Payload JWT: ${JSON.stringify(payload)}`);
    
    // Генерация токена
    const token = this.jwtService.sign(payload);
    
    this.logger.log(`JWT токен успешно сгенерирован`);
    return token;
  }

  /**
   * Валидация JWT токена (для внутреннего использования)
   * Возвращает данные пользователя из токена
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      this.logger.log(`Токен валиден для пользователя ID: ${payload.sub}`);
      return payload;
    } catch (error) {
      this.logger.warn(`Невалидный токен: ${error.message}`);
      return null;
    }
  }

  /**
   * Получение информации о текущем пользователе по JWT
   * Для использования в контроллерах через @Req() request.user
   */
  async getCurrentUser(userId: number): Promise<any> {
    this.logger.log(`Получение данных текущего пользователя ID: ${userId}`);
    
    try {
      const user = await this.usersService.findById(userId);
      this.logger.log(`Текущий пользователь: ${user.firstName} ${user.lastName}`);
      return user;
    } catch (error) {
      this.logger.error(`Ошибка получения пользователя: ${error.message}`);
      return null;
    }
  }
}