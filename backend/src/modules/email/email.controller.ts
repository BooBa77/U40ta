import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';

/**
 * Контроллер для работы с почтовым ящиком.
 * 
 * Базовый путь: /api/email
 */
@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    private readonly imapService: ImapService,
  ) {}

  /**
   * Запустить проверку почтового ящика.
   * Обычные ведомости передаются в statements-модуль,
   * инвентаризационные — в inventory-модуль через EventEmitter.
   * 
   * POST /api/email/check
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkEmailNow(): Promise<{ success: boolean; message: string }> {
    try {
      await this.imapService.checkForNewEmails();
      return { success: true, message: 'Проверка почты завершена' };
    } catch (error) {
      return { success: false, message: `Ошибка проверки почты: ${error.message}` };
    }
  }
}