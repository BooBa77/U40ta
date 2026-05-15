import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogsService } from '../../logs/logs.service';
import { EmailAttachment } from '../entities/email-attachment.entity';
import { MolAccess } from '../../users/entities/mol-access.entity';
import { EmailStorageService } from './email-storage.service';
import { AppEventsService } from '../../app-events/app-events.service';

/**
 * Сервис для работы с ведомостями МОЛ в БД (таблица email_attachments).
 * 
 * ## Назначение
 * Получение и удаление ведомостей с фильтрацией по складам пользователя.
 * Инвентаризационные ведомости обрабатываются отдельным модулем inventory.
 */
@Injectable()
export class EmailAttachmentsService {
  private readonly logger = new Logger(EmailAttachmentsService.name);

  constructor(
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    @InjectRepository(MolAccess)
    private readonly molAccessRepository: Repository<MolAccess>,
    private readonly emailStorageService: EmailStorageService,
    private readonly appEventsService: AppEventsService,
    private readonly logsService: LogsService
  ) {}

  /**
   * Получить ведомости, доступные МОЛ по userId.
   * Фильтрует по складам из mol_access. Сортировка: новые сверху.
   */
  async getAttachmentsForMol(userId: number): Promise<EmailAttachment[]> {
    const storages = await this.molAccessRepository.find({
      where: { userId },
      select: ['zavod', 'sklad']
    });

    if (storages.length === 0) {
      return [];
    }

    const conditions = storages.map(s => ({ zavod: s.zavod, sklad: s.sklad }));

    return await this.emailAttachmentRepository.find({
      where: conditions,
      order: { receivedAt: 'DESC' }
    });
  }

  /**
   * Удалить ведомость по ID.
   * Удаляет файл с диска, запись из БД, отправляет SSE.
   */
  async deleteAttachment(id: number): Promise<void> {
    const attachment = await this.emailAttachmentRepository.findOne({ where: { id } });

    if (!attachment) {
      throw new NotFoundException(`Ведомость с ID ${id} не найдена`);
    }

    try {
      await this.emailStorageService.deleteFile(attachment.filename);
    } catch (error) {
      this.logger.warn(`Ошибка удаления файла: ${error.message}`);
    }

    await this.emailAttachmentRepository.delete(id);
    this.appEventsService.notifyStatementDeleted(id);
  }
}