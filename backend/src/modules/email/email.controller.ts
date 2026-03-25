import { Controller, Post, Get, Delete, UseGuards, Req, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { EmailAttachmentsService } from './services/email-attachments.service';
import { ImapService } from './services/imap.service';
import { EmailAttachmentResponseDto } from './dto/email-attachment-response.dto';
import { DeleteAttachmentResponseDto } from './dto/delete-attachment-response.dto';

// Интерфейс для Request с пользовательскими данными из JWT токена
interface RequestWithUser extends Express.Request {
  user?: { sub: number };
}

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    private readonly imapService: ImapService,
    private readonly emailAttachmentsService: EmailAttachmentsService,
    private readonly configService: ConfigService,
  ) {}


  // 🆕 Диагностический эндпоинт
  @Get('config-debug')
  async debugConfig() {
    // Получаем конфигурацию разными способами
    const emailConfig = this.configService.get('email');
    const directImapUser = process.env.EMAIL_IMAP_USER;
    const directImapHost = process.env.EMAIL_IMAP_HOST;
    
    console.log('=== DEBUG: Проверка конфигурации ===');
    console.log('1. configService.get("email"):', emailConfig);
    console.log('2. process.env.EMAIL_IMAP_USER:', directImapUser);
    console.log('3. process.env.EMAIL_IMAP_HOST:', directImapHost);
    console.log('4. Все EMAIL_* переменные:', Object.keys(process.env).filter(k => k.startsWith('EMAIL')));
    
    return {
      viaConfigService: emailConfig ? {
        hasImap: !!emailConfig.imap,
        imapUser: emailConfig.imap?.user ? '✅' : '❌',
        imapHost: emailConfig.imap?.host || '❌',
      } : '❌ Конфигурация email не найдена',
      viaProcessEnv: {
        EMAIL_IMAP_USER: directImapUser ? '✅' : '❌',
        EMAIL_IMAP_HOST: directImapHost || '❌',
        EMAIL_IMAP_PORT: process.env.EMAIL_IMAP_PORT || '❌',
      },
    };
  }



  // Проверка почты - endpoint для инициирования проверки новых писем
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

  // Получение списка всех email-вложений с фильтрацией по доступным пользователю складам
  @Get('attachments')
  async getAllAttachments(
    @Req() request: RequestWithUser
  ): Promise<EmailAttachmentResponseDto[]> {
    const userId = request.user?.sub;
    if (!userId) return [];
    
    const attachments = await this.emailAttachmentsService.getAttachmentsForUser(userId);
    
    return attachments.map(this.toResponseDto);
  }

  // Удаление вложения по ID
  @Delete('attachments/:id')
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithUser
  ): Promise<DeleteAttachmentResponseDto> {
    const userId = request.user?.sub;
    if (!userId) {
      return { success: false, message: 'Пользователь не аутентифицирован' };
    }
    
    try {
      await this.emailAttachmentsService.deleteAttachment(id, userId);
      return {
        success: true,
        message: 'Вложение успешно удалено',
        attachmentId: id,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Ошибка при удалении вложения',
        attachmentId: id,
        error: error.message,
      };
    }
  }

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
    dto.isInventory = attachment.isInventory;
    return dto;
  }  
}