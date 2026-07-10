// backend/src/modules/auth/services/auth.service.ts

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { EmailCodeService } from './email-code.service';
import { SmtpService } from '../../email/services/smtp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailCodeService: EmailCodeService,
    private smtpService: SmtpService,
  ) {}

  /**
   * Авторизация в режиме разработки
   * Пользователя выбираем из списка на странице DevLogin.vue
   * 
   * @param userId - ID пользователя из таблицы users
   * @returns JWT токен для аутентификации
   * @throws NotFoundException если пользователь не найден
   */
  async devLogin(userId: number): Promise<AuthResponseDto> {
    this.logger.log(`Dev-авторизация для пользователя ID: ${userId}`);
    
    let user;
    try {
      user = await this.usersService.findById(userId);
    } catch (error) {
      this.logger.warn(`Пользователь с ID ${userId} не найден в таблице users`);
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    const token = await this.generateJwtToken(user);
    
    this.logger.log(`Dev-авторизация успешна для пользователя: ${user.firstName}`);
    return { access_token: token };
  }

  /**
   * Отправить код подтверждения на email.
   * 
   * @param email - email пользователя
   * @returns объект с информацией об отправке
   * 
   * @throws {BadRequestException} если email уже имеет активный код
   */
  async sendEmailCode(email: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Запрос кода подтверждения для email: ${email}`);

    // Нормализуем email
    const normalizedEmail = email.toLowerCase().trim();

    // Проверяем, есть ли уже активный код
    if (this.emailCodeService.hasActiveCode(normalizedEmail)) {
      const remaining = this.emailCodeService.getRemainingSeconds(normalizedEmail);
      const minutes = Math.ceil(remaining / 60);
      this.logger.warn(`Email ${normalizedEmail} уже имеет активный код, осталось ${remaining}с`);
      throw new BadRequestException(
        `Код уже отправлен. Подождите ${minutes} минут(ы)`
      );
    }

    // Генерируем новый код
    const code = this.emailCodeService.createCode(normalizedEmail);
    
    // Отправляем код на почту
    const subject = 'Код подтверждения U40TA';
    const text = `Ваш код подтверждения: ${code}\n\nКод действителен 5 минут.`;

    try {
      await this.smtpService.sendEmail(normalizedEmail, subject, text);
      this.logger.log(`Код отправлен на ${normalizedEmail}`);
      
      return {
        success: true,
        message: 'Код подтверждения отправлен на вашу почту'
      };
    } catch (error) {
      // Если отправка не удалась - удаляем код
      this.emailCodeService.deleteCode(normalizedEmail);
      this.logger.error(`Ошибка отправки кода на ${normalizedEmail}: ${error.message}`);
      throw new BadRequestException('Ошибка отправки письма. Попробуйте позже.');
    }
  }

  /**
   * Проверить код и авторизовать пользователя.
   * 
   * @param email - email пользователя
   * @param code - код подтверждения
   * @returns JWT токен
   * 
   * @throws {BadRequestException} если код неверный или истек
   */
  async verifyEmailCode(email: string, code: string): Promise<AuthResponseDto> {
    this.logger.log(`Проверка кода для email: ${email}`);

    const normalizedEmail = email.toLowerCase().trim();

    // Проверяем код
    const isValid = this.emailCodeService.verifyCode(normalizedEmail, code);
    
    if (!isValid) {
      this.logger.warn(`Неверный или истекший код для ${normalizedEmail}`);
      throw new BadRequestException('Неверный или истекший код подтверждения');
    }

    // Парсим email для получения имени/фамилии
    const userData = this.parseEmailToUserData(normalizedEmail);
    
    // Ищем или создаем пользователя
    let user = await this.usersService.findByEmail(normalizedEmail);
    
    if (!user) {
      this.logger.log(`Создание нового пользователя для email: ${normalizedEmail}`);
      
      user = await this.usersService.create({
        firstName: userData.firstName,
        lastName: userData.lastName,
        eMail: normalizedEmail,
      });
      
      this.logger.log(`Создан пользователь: ID ${user.id}, abr: ${user.abr}`);
    } else {
      this.logger.log(`Найден существующий пользователь: ID ${user.id}`);
    }

    // Генерируем JWT токен
    const token = await this.generateJwtToken(user);
    
    this.logger.log(`Email авторизация успешна для: ${normalizedEmail}`);
    
    return { access_token: token };
  }

  /**
   * Проверить статус кода для email.
   * Используется на фронте для восстановления состояния после F5.
   * 
   * @param email - email пользователя
   * @returns объект с информацией о статусе кода
   */
  checkEmailCodeStatus(email: string): { hasActiveCode: boolean; remainingSeconds: number } {
    const normalizedEmail = email.toLowerCase().trim();
    
    const hasActiveCode = this.emailCodeService.hasActiveCode(normalizedEmail);
    const remainingSeconds = this.emailCodeService.getRemainingSeconds(normalizedEmail);
    
    this.logger.log(`Проверка статуса кода для ${normalizedEmail}: активен=${hasActiveCode}, осталось=${remainingSeconds}с`);
    
    return { hasActiveCode, remainingSeconds };
  }

  /**
   * Парсинг email для извлечения имени, фамилии и аббревиатуры.
   * 
   * @param email - email пользователя (например, ivanovii@domain.com)
   * @returns объект с firstName, lastName, abr
   * 
   * ## Алгоритм
   * 1. Берем часть до @
   * 2. Если длина >= 3:
   *    - firstName = последние 2 символа
   *    - lastName = все остальное
   *    - abr = первая буква lastName + firstName
   * 3. Если длина < 3:
   *    - firstName = все что есть
   *    - lastName = все что есть
   *    - abr = все что есть
   * 
   * ## Примеры
   * - ivanovii@domain.com → firstName: "ii", lastName: "ivanov", abr: "iii"
   * - petrov@domain.com → firstName: "ov", lastName: "petr", abr: "pov"
   * - a@mail.ru → firstName: "a", lastName: "a", abr: "a"
   */
  private parseEmailToUserData(email: string): { firstName: string; lastName: string; abr: string } {
    // Берем часть до @
    const localPart = email.split('@')[0];
    
    let firstName: string;
    let lastName: string;
    let abr: string;
    
    if (localPart.length >= 3) {
      // Длина >= 3: берем последние 2 символа как firstName
      firstName = localPart.slice(-2);
      lastName = localPart.slice(0, -2);
      abr = lastName.charAt(0) + firstName;
    } else {
      // Длина < 3: все что есть
      firstName = localPart;
      lastName = localPart;
      abr = localPart;
    }
    
    this.logger.debug(`Парсинг email ${email}: firstName="${firstName}", lastName="${lastName}", abr="${abr}"`);
    
    return { firstName, lastName, abr };
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
      email: user.eMail,               // Email пользователя
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