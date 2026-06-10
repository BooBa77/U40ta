import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { StatementParserService } from './statement-parser.service';
import { StatementObjectsService } from './statement-objects.service';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { UpdateActualDto } from '../dto/update-actual.dto';


@Injectable()
export class StatementService {
  constructor(
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,
    
    @InjectRepository(ProcessedStatement)
    private processedStatementRepo: Repository<ProcessedStatement>,
    
    private parserService: StatementParserService,
    private objectsService: StatementObjectsService,
  ) {}

  /**
   * Поиск записей ведомости по инвентарному номеру, партии и складу
   * Возвращает только записи с haveObject = false (объект ещё не создан)
   */
  async findByInv(
    invNumber: string,
    zavod?: number,
    sklad?: string,
    partyNumber?: string
  ): Promise<ProcessedStatement[]> {
    const queryBuilder = this.processedStatementRepo
      .createQueryBuilder('statement')
      .where('statement.haveObject = :haveObject', { haveObject: false })
      .andWhere('statement.invNumber = :invNumber', { invNumber });

    if (zavod !== undefined && !isNaN(zavod)) {
      queryBuilder.andWhere('statement.zavod = :zavod', { zavod });
    }

    if (sklad && sklad.trim() !== '') {
      queryBuilder.andWhere('statement.sklad = :sklad', { sklad });
    }

    if (partyNumber && partyNumber.trim() !== '') {
      queryBuilder.andWhere('statement.partyNumber = :partyNumber', { partyNumber });
    }

    return await queryBuilder.getMany();
  }  

  /**
   * Основной метод: открывает/обрабатывает ведомость
   * GET /api/statements/:attachmentId
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatement[]> {
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }

    if (attachment.inProcess) {
      return await this.parserService.getExistingStatements(attachmentId);
    }

    try {
      // Первое открытие - парсим файл
      const statements = await this.parserService.parseStatement(attachmentId);

      // Устанавливаем флаг inProcess в true
      attachment.inProcess = true;
      await this.emailAttachmentRepo.save(attachment);      

      // Отправляем SSE уведомление об обновлении статуса
      this.appEventsService.notifyStatementUpdated(attachmentId);

      if (attachment.zavod && attachment.sklad && attachment.docType) {
        await this.objectsService.updateHaveObjectsForStatement(
          attachment.zavod,
          attachment.sklad,
          attachment.docType,
        );
      }

      return statements;
      
    } catch (error) {
      console.error('StatementService: ошибка обработки ведомости:', error);
      throw new InternalServerErrorException(
        `Ошибка обработки ведомости: ${error.message}`,
      );
    }
  }

  /**
   * Обновляет статус актуальности/игнорирования для группы строк
   * POST /api/statements/actual
   */
  async updateActualStatus(dto: UpdateActualDto): Promise<ProcessedStatement[]> {
    const statements = await this.processedStatementRepo.find({
      where: {
        emailAttachmentId: dto.attachmentId,
        invNumber: dto.invNumber,
        isExcess: false,
      },
    });
    
    if (statements.length === 0) {
      return [];
    }
    
    for (const statement of statements) {
      statement.isActual = dto.isActual;
    }
    
    await this.processedStatementRepo.save(statements);
    
    return statements;
  }  
}