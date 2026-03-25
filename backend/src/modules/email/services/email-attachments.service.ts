import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../entities/email-attachment.entity';
import { MolAccess } from '../../users/entities/mol-access.entity';
import { EmailStorageService } from './email-storage.service';
import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class EmailAttachmentsService {
  constructor(
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    @InjectRepository(MolAccess)
    private readonly molAccessRepository: Repository<MolAccess>,
    private readonly emailStorageService: EmailStorageService,
    private readonly appEventsService: AppEventsService,
  ) {}

  /**
   * Получить все вложения, доступные пользователю
   */
  async getAttachmentsForUser(userId: number): Promise<EmailAttachment[]> {
    // 1. Получаем доступные склады
    const accessibleStorages = await this.getUserAccessibleStorages(userId);
    
    if (accessibleStorages.length === 0) {
      return [];
    }

    // 2. Строим запрос с фильтрацией
    const query = this.buildFilteredQuery(accessibleStorages);
    
    // 3. Выполняем запрос
    return await query
      .orderBy('attachment.receivedAt', 'DESC')
      .getMany();
  }

  /**
   * Удалить вложение по ID с проверкой прав
   */
  async deleteAttachment(id: number, userId: number): Promise<void> {
    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepository.findOne({
      where: { id }
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${id} не найдено`);
    }

    // 2. Проверяем права доступа (только если у вложения есть склад)
    if (attachment.zavod && attachment.sklad) {
      await this.checkUserAccessToAttachment(attachment, userId);
    }

    // 3. Удаляем физический файл
    try {
      await this.emailStorageService.deleteFile(attachment.filename);
    } catch (error) {
      console.warn(`Ошибка при удалении файла ${attachment.filename}:`, error);
    }

    // 4. Удаляем запись из БД
    await this.emailAttachmentRepository.delete(id);
    
    // 5. Отправляем SSE уведомление
    this.appEventsService.notifyStatementDeleted(id);
  }

  /**
   * Получить доступные пользователю склады
   */
  private async getUserAccessibleStorages(userId: number): Promise<MolAccess[]> {
    return await this.molAccessRepository.find({
      where: { userId: userId },
      select: ['zavod', 'sklad']
    });
  }

  /**
   * Построить запрос с фильтрацией по доступным складам
   */
  private buildFilteredQuery(accessibleStorages: MolAccess[]) {
    const query = this.emailAttachmentRepository.createQueryBuilder('attachment');
    
    // Если доступен только один склад - простое условие
    if (accessibleStorages.length === 1) {
      const storage = accessibleStorages[0];
      return query.where(
        'attachment.zavod = :zavod AND attachment.sklad = :sklad',
        { zavod: storage.zavod, sklad: storage.sklad }
      );
    }
    
    // Если несколько складов - строим OR условия
    const conditions = accessibleStorages.map((_, index) => 
      `(attachment.zavod = :zavod${index} AND attachment.sklad = :sklad${index})`
    ).join(' OR ');
    
    const params = accessibleStorages.reduce((acc, storage, index) => ({
      ...acc,
      [`zavod${index}`]: storage.zavod,
      [`sklad${index}`]: storage.sklad,
    }), {});
    
    return query.where(conditions, params);
  }

  /**
   * Проверить, имеет ли пользователь доступ к вложению
   */
  private async checkUserAccessToAttachment(
    attachment: EmailAttachment, 
    userId: number
  ): Promise<void> {
    // Проверяем, что у вложения есть zavod и sklad
    if (!attachment.zavod || !attachment.sklad) {
      throw new ForbiddenException(
        `Вложение не привязано к складу, доступ невозможен`
      );
    }

    const hasAccess = await this.molAccessRepository.findOne({
      where: {
        userId: userId,
        zavod: attachment.zavod,
        sklad: attachment.sklad
      }
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        `У вас нет доступа к вложению из склада ${attachment.sklad} (завод ${attachment.zavod})`
      );
    }
  }
}