import { Controller, Post, Body, Logger, NotFoundException, BadRequestException, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { SendCodeDto, VerifyCodeDto, CheckCodeStatusDto } from './dto/email-auth.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

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
   */
  @Post('email/send-code')
  @UsePipes(new ValidationPipe({ transform: true }))
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
   */
  @Post('email/verify')
  @UsePipes(new ValidationPipe({ transform: true }))
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
   * 
   * POST /api/auth/email/check-status
   */
  @Post('email/check-status')
  @UsePipes(new ValidationPipe({ transform: true }))
  async checkEmailCodeStatus(@Body() body: CheckCodeStatusDto) {
    this.logger.log(`Проверка статуса кода для email: ${body.email}`);
    
    return this.authService.checkEmailCodeStatus(body.email);
  }
}