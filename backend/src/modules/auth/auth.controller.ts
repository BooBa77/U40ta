import { Controller, Post, Body, Logger, NotFoundException } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { TelegramLoginDto } from './dto/telegram-login.dto';

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
}