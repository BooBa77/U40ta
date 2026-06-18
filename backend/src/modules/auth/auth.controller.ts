import { Controller, Post, Body, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { TelegramLoginDto } from './dto/telegram-login.dto';

/**
 * DTO для запроса кода подтверждения
 */
class SendCodeDto {
  email!: string;
}

/**
 * DTO для проверки кода
 */
class VerifyCodeDto {
  email!: string;
  code!: string;
}

/**
 * DTO для проверки статуса кода
 */
class CheckCodeStatusDto {
  email!: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegramLogin(@Body() telegramData: TelegramLoginDto) {
    this.logger.log(`Telegram авторизация: ${telegramData.first_name}`);

    // Просто вызываем сервис, ВСЕГДА получаем токен
    const result = await this.authService.telegramLogin(telegramData);
    
    this.logger.log(`Авторизация успешна: ${telegramData.first_name}`);
    return result; // Всегда { access_token }
  }

  @Post('dev-login')
  async devLogin(@Body() { userId }: { userId: number }) {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('Попытка dev-login в продакшене');
      throw new NotFoundException('Метод не найден');
    }

    this.logger.log(`Dev-авторизация: ${userId}`);
    const result = await this.authService.devLogin(userId);
    
    return result;
  }

  /**
   * Отправить код подтверждения на email.
   * 
   * POST /api/auth/email/send-code
   * 
   * @param body.email - email пользователя
   * @returns { success: true, message: string }
   */
  @Post('email/send-code')
  async sendEmailCode(@Body() body: SendCodeDto) {
    this.logger.log(`Запрос кода для email: ${body.email}`);
    
    try {
      const result = await this.authService.sendEmailCode(body.email);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Ошибка отправки кода: ${error.message}`);
      throw new BadRequestException('Ошибка отправки кода');
    }
  }

  /**
   * Проверить код и получить JWT токен.
   * 
   * POST /api/auth/email/verify
   * 
   * @param body.email - email пользователя
   * @param body.code - код подтверждения
   * @returns { access_token: string }
   */
  @Post('email/verify')
  async verifyEmailCode(@Body() body: VerifyCodeDto) {
    this.logger.log(`Проверка кода для email: ${body.email}`);
    
    try {
      const result = await this.authService.verifyEmailCode(body.email, body.code);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Ошибка проверки кода: ${error.message}`);
      throw new BadRequestException('Ошибка проверки кода');
    }
  }

  /**
   * Проверить статус кода для email.
   * Используется на фронте для восстановления состояния после F5.
   * 
   * POST /api/auth/email/check-status
   * 
   * @param body.email - email пользователя
   * @returns { hasActiveCode: boolean, remainingSeconds: number }
   */
  @Post('email/check-status')
  async checkEmailCodeStatus(@Body() body: CheckCodeStatusDto) {
    this.logger.log(`Проверка статуса кода для email: ${body.email}`);
    
    return this.authService.checkEmailCodeStatus(body.email);
  }
}