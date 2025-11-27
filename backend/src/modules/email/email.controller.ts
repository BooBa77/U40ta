import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly imapService: ImapService) {}

  @Post('check-now')
  async checkEmailNow() {
    try {
      console.log('🔄 Ручная проверка почты...');
      await this.imapService.checkForNewEmails();
      return { 
        success: true, 
        message: 'Проверка почты завершена' 
      };
    } catch (error) {
      console.error('❌ Ошибка ручной проверки почты:', error);
      return { 
        success: false, 
        message: 'Ошибка проверки почты: ' + error.message 
      };
    }
  }
}