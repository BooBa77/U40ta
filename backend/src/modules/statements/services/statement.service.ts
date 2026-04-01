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
    const queryBuilder = this.processedStatementRepo
      .createQueryBuilder('statement')
      .where('statement.have_object = :haveObject', { haveObject: false })
      .andWhere('statement.inv_number = :invNumber', { invNumber });

    if (zavod !== undefined && !isNaN(zavod)) {
      queryBuilder.andWhere('statement.zavod = :zavod', { zavod });
    }

    if (sklad && sklad.trim() !== '') {
      queryBuilder.andWhere('statement.sklad = :sklad', { sklad });
    }

    const statements = await queryBuilder.getMany();

    return statements;
  }

  /**
   * Основной метод: открывает/обрабатывает ведомость
   * GET /api/statements/:attachmentId
   */
  async parseStatement(attachmentId: number): Promise<ProcessedStatementDto[]> {
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
      relations: [],
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }

    if (attachment.isInventory) {
      return [];
    }

    if (attachment.inProcess) {
      const statements = await this.parserService.getExistingStatements(attachmentId);
      return statements;
    }

    try {
      const statements = await this.parserService.parseStatement(attachmentId);
      
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
   * Обновляет статус игнорирования для группы строк
   * POST /api/statements/ignore
   */
  async updateIgnoreStatus(dto: UpdateIgnoreDto): Promise<ProcessedStatementDto[]> {
    const statements = await this.processedStatementRepo.find({
      where: {
        emailAttachmentId: dto.attachmentId,
        inv_number: dto.invNumber,
        party_number: dto.partyNumber || '',
        is_excess: false,
      },
    });
    
    if (statements.length === 0) {
      return [];
    }
    
    for (const statement of statements) {
      statement.is_ignore = dto.isIgnore;
    }
    
    await this.processedStatementRepo.save(statements);
    
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