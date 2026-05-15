import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailAttachmentsService } from './services/email-attachments.service';
import { ImapService } from './services/imap.service';
import { EmailAttachmentResponseDto } from './dto/email-attachment-response.dto';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

/**
 * Контроллер для работы с ведомостями МОЛ, полученными по email.
 * Инвентаризационные ведомости обрабатываются отдельным модулем inventory.
 * 
 * Базовый путь: /api/email
 */
@Controller('email')
@UseGuards(JwtAuthGuard) // JWT-аутентификация для всех эндпоинтов
export class EmailController {
  constructor(
    private readonly imapService: ImapService,
    private readonly emailAttachmentsService: EmailAttachmentsService,
  ) {}

  /**
   * Запустить ручную проверку почтового ящика.
   * Инвентаризационные ведомости передаются в inventory-модуль через EventEmitter.
   * 
   * POST /api/email/check
   */
  @Post('check')
  @HttpCode(HttpStatus.OK) // 200 вместо 201 для POST
  async checkEmailNow(): Promise<{ success: boolean; message: string }> {
    try {
      await this.imapService.checkForNewEmails();
      return { success: true, message: 'Проверка почты завершена' };
    } catch (error) {
      return { success: false, message: `Ошибка проверки почты: ${error.message}` };
    }
  }

  /**
   * Получить ведомости, доступные пользователю МОЛ.
   * Фильтрация по складам из mol_access.
   * 
   * GET /api/email/attachments
   */
  @Get('attachments')
  async getAllAttachments(
    @Req() request: RequestWithUser
  ): Promise<EmailAttachmentResponseDto[]> {
    const userId = request.user.sub;
    if (!userId) {
      return [];
    }

    const attachments = await this.emailAttachmentsService.getAttachmentsForMol(userId);
    return attachments.map(a => this.toResponseDto(a));
  }

  /**
   * Удалить ведомость по ID.
   * Удаляет файл с диска, запись из БД, отправляет SSE.
   * 
   * DELETE /api/email/attachments/:id
   */
  @Delete('attachments/:id')
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithUser
  ): Promise<{ success: boolean; message: string; attachmentId?: number; error?: string }> {
    if (!request.user.sub) {
      return { success: false, message: 'Пользователь не аутентифицирован' };
    }

    try {
      await this.emailAttachmentsService.deleteAttachment(id);
      return { success: true, message: 'Ведомость удалена', attachmentId: id };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Ошибка при удалении ведомости',
        attachmentId: id,
        error: error.message
      };
    }
  }

  /**
   * Преобразовать сущность в DTO для ответа фронтенду.
   */
  private toResponseDto(attachment: any): EmailAttachmentResponseDto {
    const dto = new EmailAttachmentResponseDto();
    dto.id = attachment.id;
    dto.filename = attachment.filename;
    dto.emailFrom = attachment.emailFrom;
    dto.receivedAt = attachment.receivedAt;
    dto.docType = attachment.docType;
    dto.zavod = attachment.zavod;
    dto.sklad = attachment.sklad;
    dto.inProcess = attachment.inProcess;
    return dto;
  }
}