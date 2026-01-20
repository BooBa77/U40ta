import { Controller, Post, Get, Delete, UseGuards, Req, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './services/imap.service';
import { Repository } from 'typeorm';
import { EmailAttachment } from './entities/email-attachment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailAttachmentResponseDto } from './dto/email-attachment-response.dto'; // Импорт DTO
import { DeleteAttachmentResponseDto } from './dto/delete-attachment-response.dto'; // Импорт DTO
import { AppEventsService } from '../app-events/app-events.service'; // Для SSE уведомлений
import * as fs from 'fs';
import * as path from 'path';

interface RequestWithUser extends ExpressRequest {
  user?: {
    role: string;
    sub: number;
  };
}

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    private readonly imapService: ImapService,
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    private readonly appEventsService: AppEventsService, // Добавляем для SSE
  ) {}

  // Ручная проверка почты
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

  // Получение списка всех email-вложений с DTO
  @Get('attachments')
  async getAllAttachments(@Req() request: RequestWithUser): Promise<EmailAttachmentResponseDto[]> {
    console.log('Запрос списка email-вложений...');
    
    const userRole = request.user?.role;
    
    // Проверка роли
    if (!userRole) {
      console.log('Пользователь без роли');
      return [];
    }
    
    if (userRole !== 'admin' && userRole !== 'МОЛ') {
      console.log(`Доступ запрещён для роли: ${userRole}`);
      return [];
    }
    
    // Создаём запрос
    const query = this.emailAttachmentRepository.createQueryBuilder('attachment');
    
    // Фильтрация по типу документа только для 'МОЛ'
    if (userRole === 'МОЛ') {
      query.where('attachment.doc_type IN (:...types)', { 
        types: ['ОСВ', 'ОС'] 
      });
      console.log('Фильтр для МОЛ: только ОСВ и ОС');
    } else {
      console.log('Админ: все файлы');
    }
    
    // Сортировка и выполнение
    const attachments = await query
      .orderBy('attachment.received_at', 'DESC')
      .getMany();
    
    console.log(`Найдено записей: ${attachments.length}`);
    
    // Преобразуем Entity в DTO
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
      // Находим вложение
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
      
      // Удаляем физический файл (если существует)
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
        // Игнорируем ошибку, продолжаем удаление записи из БД
      }
      
      // Удаляем запись из БД (каскадное удаление processed_statements через FK)
      await this.emailAttachmentRepository.delete(id);
      console.log(`Запись удалена из БД: ID ${id}`);
      
      // Отправляем SSE уведомление об удалении
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

  // Приватный метод для получения пути к файлу
  private getAttachmentFilePath(filename: string): string {
    const projectRoot = process.cwd();
    const emailAttachmentsDir = path.join(projectRoot, '..', 'email-attachments');
    return path.join(emailAttachmentsDir, filename);
  }
}