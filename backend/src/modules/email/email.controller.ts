import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
//import { Request } from 'express';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';
import { Repository } from 'typeorm'; // Импортируем репозиторий для работы с базой данных
import { EmailAttachment } from './entities/email-attachment.entity'; // Импортируем сущность (модель) таблицы email_attachments
import { InjectRepository } from '@nestjs/typeorm'; // Декоратор для внедрения репозитория

interface RequestWithUser extends ExpressRequest {
  user?: {
    role: string;
    sub: number;
  };
}

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
  //async getAllAttachments(@Req() request: Request) {
  async getAllAttachments(@Req() request: RequestWithUser) {
    
    console.log('📄 Запрос списка email-вложений...');
    
    //const userRole = request.user?.role;
    const userRole = request.user?.role;
    
    // 1. Проверка роли
    if (!userRole) {
      console.log('⛔ Пользователь без роли');
      return [];
    }
    
    if (userRole !== 'admin' && userRole !== 'МОЛ') {
      console.log(`⛔ Доступ запрещён для роли: ${userRole}`);
      return [];
    }
    
    // 2. Создаём запрос
    const query = this.emailAttachmentRepository.createQueryBuilder('attachment');
    
    // 3. Фильтрация по типу документа только для 'МОЛ'
    if (userRole === 'МОЛ') {
      query.where('attachment.doc_type IN (:...types)', { 
        types: ['ОСВ', 'ОС'] 
      });
      console.log('🔹 Фильтр для МОЛ: только ОСВ и ОС');
    } else {
      console.log('🔹 Админ: все файлы');
    }
    
    // 4. Сортировка и выполнение
    const attachments = await query
      .orderBy('attachment.received_at', 'DESC')
      .getMany();
    
    console.log(`✅ Найдено записей: ${attachments.length}`);
    return attachments;
  }
  
  /*
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
  */

}