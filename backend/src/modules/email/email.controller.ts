import { Controller, Post, Get, Delete, UseGuards, Req, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';
import { Repository } from 'typeorm';
import { EmailAttachment } from './entities/email-attachment.entity';
import { MolAccess } from '../statements/entities/mol-access.entity'; // Импорт сущности MolAccess
import { InjectRepository } from '@nestjs/typeorm';
import { EmailAttachmentResponseDto } from './dto/email-attachment-response.dto';
import { DeleteAttachmentResponseDto } from './dto/delete-attachment-response.dto';
import { AppEventsService } from '../app-events/app-events.service';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейс для Request с пользовательскими данными из JWT токена
interface RequestWithUser extends ExpressRequest {
  user?: {
    role: string;
    sub: number; // ID пользователя
  };
}

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    private readonly imapService: ImapService,
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    @InjectRepository(MolAccess)
    private readonly molAccessRepository: Repository<MolAccess>, // Репозиторий для доступа к таблице mol_access
    private readonly appEventsService: AppEventsService,
  ) {}

  // Ручная проверка почты - endpoint для инициирования проверки новых писем
  @Post('check-now')
  async checkEmailNow() {
    try {
      console.log('Ручная проверка почты...');
      await this.imapService.checkForNewEmails();
      return { 
        success: true, 
        message: 'Проверка почты завершена' 
      };
    } catch (error) {
      console.error('Ошибка ручной проверки почты:', error);
      return { 
        success: false, 
        message: 'Ошибка проверки почты: ' + error.message 
      };
    }
  }

  // Получение списка всех email-вложений с фильтрацией по доступным пользователю складам
  @Get('attachments')
  async getAllAttachments(@Req() request: RequestWithUser): Promise<EmailAttachmentResponseDto[]> {
    console.log('Запрос списка email-вложений для пользователя ID:', request.user?.sub);
    
    const userId = request.user?.sub;
    if (!userId) {
      console.log('Пользователь не аутентифицирован');
      return [];
    }
    
    // 1. Получаем доступные zavod/sklad для пользователя из таблицы mol_access
    const molAccess = await this.molAccessRepository.find({
      where: { userId: userId },
      select: ['zavod', 'sklad']
    });
    
    console.log(`Найдено записей в mol_access для пользователя ${userId}: ${molAccess.length}`);
    
    // 2. Если у пользователя нет доступных складов - возвращаем пустой массив
    if (molAccess.length === 0) {
      console.log('У пользователя нет доступных складов в mol_access');
      return [];
    }
    
    // 3. Создаём запрос с фильтрацией по доступным zavod/sklad
    const query = this.emailAttachmentRepository.createQueryBuilder('attachment');
    
    // Формируем условие WHERE для всех пар (zavod, sklad) через OR
    // Используем параметризованный запрос для безопасности
    const whereConditions = molAccess.map((access, index) => {
      return `(attachment.zavod = :zavod${index} AND attachment.sklad = :sklad${index})`;
    }).join(' OR ');
    
    // Создаём объект параметров для безопасной подстановки значений
    const parameters = {};
    molAccess.forEach((access, index) => {
      parameters[`zavod${index}`] = access.zavod;
      parameters[`sklad${index}`] = access.sklad;
    });
    
    // Применяем условие WHERE с параметрами
    query.where(`(${whereConditions})`, parameters);
    
    // 4. Сортировка по дате получения (новые сверху) и выполнение запроса
    const attachments = await query
      .orderBy('attachment.received_at', 'DESC')
      .getMany();
    
    console.log(`Найдено доступных вложений для пользователя ${userId}: ${attachments.length}`);
    
    // 5. Преобразуем Entity в DTO для возврата клиенту
    return attachments.map(attachment => {
      const dto = new EmailAttachmentResponseDto();
      dto.id = attachment.id;
      dto.filename = attachment.filename;
      dto.email_from = attachment.email_from;
      dto.received_at = attachment.received_at;
      dto.doc_type = attachment.doc_type;
      dto.zavod = attachment.zavod;
      dto.sklad = attachment.sklad;
      dto.in_process = attachment.in_process;
      dto.is_inventory = attachment.is_inventory;
      return dto;
    });
  }

  // Удаление вложения по ID
  @Delete('attachments/:id')
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeleteAttachmentResponseDto> {
    console.log(`Запрос на удаление вложения ID: ${id}`);
    
    try {
      // Находим вложение по ID
      const attachment = await this.emailAttachmentRepository.findOne({
        where: { id }
      });
      
      if (!attachment) {
        console.log(`Вложение с ID ${id} не найдено`);
        const response = new DeleteAttachmentResponseDto();
        response.success = false;
        response.message = 'Вложение не найдено';
        return response;
      }
      
      // Удаляем физический файл с диска (если существует)
      // Игнорируем ошибки если файл уже удалён или недоступен
      try {
        const filePath = this.getAttachmentFilePath(attachment.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Физический файл удален: ${attachment.filename}`);
        } else {
          console.log(`Физический файл не найден, пропускаем: ${attachment.filename}`);
        }
      } catch (fileError) {
        console.warn(`Ошибка при удалении файла, продолжаем: ${fileError.message}`);
        // Продолжаем удаление записи из БД даже если файл не удалился
      }
      
      // Удаляем запись из БД
      // Каскадное удаление связанных записей в processed_statements происходит через FOREIGN KEY CONSTRAINT
      await this.emailAttachmentRepository.delete(id);
      console.log(`Запись удалена из БД: ID ${id}`);
      
      // Отправляем SSE уведомление об удалении вложения
      // StatementPage.vue использует это событие для редиректа если открытая ведомость была удалена
      this.appEventsService.notifyEmailAttachmentDeleted(id);
      console.log('Отправлено SSE уведомление об удалении');
      
      // Возвращаем успешный ответ
      const response = new DeleteAttachmentResponseDto();
      response.success = true;
      response.message = 'Вложение успешно удалено';
      response.attachmentId = id;
      return response;
      
    } catch (error) {
      console.error(`Ошибка при удалении вложения ID ${id}:`, error);
      
      const response = new DeleteAttachmentResponseDto();
      response.success = false;
      response.message = 'Ошибка при удалении вложения';
      response.error = error.message;
      response.attachmentId = id;
      return response;
    }
  }

  // Вспомогательный метод для получения полного пути к файлу вложения
  private getAttachmentFilePath(filename: string): string {
    const projectRoot = process.cwd();
    const emailAttachmentsDir = path.join(projectRoot, '..', 'email-attachments');
    return path.join(emailAttachmentsDir, filename);
  }
}