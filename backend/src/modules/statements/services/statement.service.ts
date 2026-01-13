import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { StatementParserService } from './statement-parser.service';
import { StatementObjectsService } from './statement-objects.service';
import { AppEventsService } from '../../app-events/app-events.service';
import { ProcessedStatementDto } from '../dto/statement-response.dto';

@Injectable()
export class StatementService {
  constructor(
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,
    private parserService: StatementParserService,
    private objectsService: StatementObjectsService,
    private appEventsService: AppEventsService,
  ) {}

  /**
   * Основной метод: открывает/обрабатывает ведомость
   * GET /api/statements/:attachmentId
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatementDto[]> {
    console.log(`StatementService: запрос на ведомость ID: ${attachmentId}`);

    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
      relations: [], // если понадобятся связи
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }

    // 2. Пропускаем инвентаризацию
    if (attachment.is_inventory) {
      console.log(`StatementService: пропускаем инвентаризацию (ID: ${attachmentId})`);
      return [];
    }

    // 3. Если ведомость уже в работе - возвращаем существующие записи
    if (attachment.in_process) {
      console.log(`StatementService: ведомость уже в работе, возвращаем существующие записи`);
      
      const statements = await this.parserService.getExistingStatements(attachmentId);
      
      // Фоновое обновление флагов (не блокирует ответ)
      this.updateFlagsInBackground(attachment);
      return statements;
    }

    // 4. Полная обработка новой ведомости
    try {
      // 4.1 Парсим Excel
      const statements = await this.parserService.parseStatement(attachmentId);
      
      // 4.2 Обновляем флаги have_object/is_excess
      if (attachment.zavod && attachment.sklad && attachment.doc_type) {
        await this.objectsService.updateHaveObjectsForStatement(
          attachment.zavod,
          attachment.sklad,
          attachment.doc_type,
        );
      }
      
      // 4.3 Отправляем SSE уведомление
      if (attachment.zavod && attachment.sklad && attachment.doc_type) {
        this.appEventsService.notifyStatementUpdated(
          attachment.zavod.toString(),
          attachment.sklad,
          attachment.doc_type,
        );
      }
      
      console.log(`StatementService: ведомость успешно обработана, записей: ${statements.length}`);

      return statements;
      
    } catch (error) {
      console.error('StatementService: ошибка обработки ведомости:', error);
      throw new InternalServerErrorException(
        `Ошибка обработки ведомости: ${error.message}`,
      );
    }
  }

  /**
   * Фоновое обновление флагов для уже открытой ведомости
   */
  private async updateFlagsInBackground(attachment: EmailAttachment): Promise<void> {
    if (!attachment.zavod || !attachment.sklad || !attachment.doc_type) {
      return;
    }

    try {
      // Обновляем флаги в фоне
      await this.objectsService.updateHaveObjectsForStatement(
        attachment.zavod,
        attachment.sklad,
        attachment.doc_type,
      );
      
      // Уведомляем об обновлении
      this.appEventsService.notifyStatementUpdated(
        attachment.zavod.toString(),
        attachment.sklad,
        attachment.doc_type,
      );
      
      console.log(`StatementService: фоновое обновление флагов завершено для ${attachment.sklad}`);
    } catch (error) {
      console.error('StatementService: ошибка фонового обновления флагов:', error);
    }
  }
}