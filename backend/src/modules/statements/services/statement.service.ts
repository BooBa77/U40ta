import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { StatementParserService } from './statement-parser.service';
import { StatementObjectsService } from './statement-objects.service';
import { ProcessedStatementDto } from '../dto/statement-response.dto';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { UpdateIgnoreDto } from '../dto/update-ignore.dto';

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
   * Возвращает только записи с have_object = false (объект ещё не создан)
   */
  async findByInv(
    invNumber: string,
    zavod?: number,
    sklad?: string
  ): Promise<ProcessedStatement[]> {
    console.log(`[StatementService] Поиск записей ведомости: inv=${invNumber}, zavod=${zavod}, sklad=${sklad}`);

    const queryBuilder = this.processedStatementRepo
      .createQueryBuilder('statement')
      .where('statement.have_object = :haveObject', { haveObject: false })
      .andWhere('statement.inv_number = :invNumber', { invNumber });

    // Фильтрация по заводу
    if (zavod !== undefined && !isNaN(zavod)) {
      queryBuilder.andWhere('statement.zavod = :zavod', { zavod });
    }

    // Фильтрация по складу
    if (sklad && sklad.trim() !== '') {
      queryBuilder.andWhere('statement.sklad = :sklad', { sklad });
    }

    const statements = await queryBuilder.getMany();

    console.log(`[StatementService] Найдено записей ведомости: ${statements.length}`);
    return statements;
  }

  /**
   * Основной метод: открывает/обрабатывает ведомость
   * GET /api/statements/:attachmentId
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatementDto[]> {
    console.log(`StatementService: запрос на ведомость ID: ${attachmentId}`);

    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
      relations: [],
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }

    if (attachment.is_inventory) {
      console.log(`StatementService: пропускаем инвентаризацию (ID: ${attachmentId})`);
      return [];
    }

    if (attachment.in_process) {
      console.log(`StatementService: ведомость уже в работе, возвращаем существующие записи`);
      
      const statements = await this.parserService.getExistingStatements(attachmentId);
      
      return statements;
    }

    try {
      const statements = await this.parserService.parseStatement(attachmentId);
      
      if (attachment.zavod && attachment.sklad && attachment.doc_type) {
        await this.objectsService.updateHaveObjectsForStatement(
          attachment.zavod,
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
   * Обновляет статус игнорирования для группы строк
   * POST /api/statements/ignore
   */
  async updateIgnoreStatus(dto: UpdateIgnoreDto): Promise<ProcessedStatementDto[]> {
    console.log(`StatementService: обновление is_ignore для ${dto.invNumber}/${dto.partyNumber || '(без партии)'}`);
    
    const statements = await this.processedStatementRepo.find({
      where: {
        emailAttachmentId: dto.attachmentId,
        inv_number: dto.invNumber,
        party_number: dto.partyNumber || '',
        is_excess: false,
      },
    });
    
    if (statements.length === 0) {
      console.warn(`StatementService: записи не найдены для обновления`);
      return [];
    }
    
    console.log(`StatementService: найдено записей для обновления: ${statements.length}`);
    
    for (const statement of statements) {
      statement.is_ignore = dto.isIgnore;
    }
    
    await this.processedStatementRepo.save(statements);
    console.log(`StatementService: обновлено записей: ${statements.length}`);
    
    if (statements.length > 0) {
      const first = statements[0];
      if (first.zavod && first.sklad && first.doc_type) {
        this.objectsService.updateHaveObjectsForStatement(
          first.zavod,
          first.sklad,
          first.doc_type,
        ).catch(err => console.error('StatementService: ошибка фонового обновления флагов:', err));
      }
    }
    
    return ProcessedStatementDto.fromEntities(statements);
  }
}