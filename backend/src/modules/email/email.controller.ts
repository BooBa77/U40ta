import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';
import { Repository } from 'typeorm'; // Импортируем репозиторий для работы с базой данных
import { EmailAttachment } from './entities/email-attachment.entity'; // Импортируем сущность (модель) таблицы email_attachments
import { InjectRepository } from '@nestjs/typeorm'; // Декоратор для внедрения репозитория

@Controller('email') // Все маршруты этого контроллера начинаются с /api/email
@UseGuards(JwtAuthGuard) // Защищаем все endpoint'ы JWT-авторизацией
export class EmailController {
  constructor(
    private readonly imapService: ImapService, // Сервис для работы с почтой
    // Внедряем репозиторий для таблицы email_attachments
    // Репозиторий — это готовый набор методов для работы с таблицей в БД
    // (find, save, update, delete и т.д.)
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
  ) {}

  // Ручная проверка почты
  @Post('check-now') // POST /api/email/check-now
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

  // Получение списка всех email-вложений
  @Get('attachments') // GET /api/email/attachments
  async getAllAttachments() {
    try {
      console.log('📄 Запрос списка email-вложений...');
      
      // Используем репозиторий для получения всех записей из таблицы
      // order: { received_at: 'DESC' } — сортируем по дате получения, новые сверху
      const attachments = await this.emailAttachmentRepository.find({
        order: { received_at: 'DESC' },
      });
      
      console.log(`✅ Найдено записей: ${attachments.length}`);
      return attachments;
      
    } catch (error) {
      // В случае ошибки логируем и возвращаем пустой массив
      // Это безопаснее для фронтенда — он не упадёт, а покажет "Файлов нет"
      console.error('❌ Ошибка получения вложений:', error);
      return [];
    }
  }
}