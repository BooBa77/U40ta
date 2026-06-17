import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProposedChange } from './entities/proposed-change.entity';

/**
 * Сервис для работы с предлагаемыми изменениями.
 * 
 * ## Назначение
 * Управление записями в таблице proposed_changes:
 * - Создание пакетов изменений от гостей
 * - В будущем: подтверждение/отклонение МОЛом, получение списка pending-изменений
 */
@Injectable()
export class ProposedChangesService {
  private readonly logger = new Logger(ProposedChangesService.name);

  constructor(
    @InjectRepository(ProposedChange)
    private readonly proposedChangesRepository: Repository<ProposedChange>,
  ) {}

  /**
   * Создаёт пакет записей предлагаемых изменений.
   * 
   * Все записи создаются в одной транзакции со статусом `pending`.
   * Если какая-то запись не проходит валидацию БД — транзакция откатывается.
   * 
   * @param changes — массив изменений: { objectId, changeType, proposedData }
   * @param userId — ID пользователя-гостя, предложившего изменения
   * @returns Массив созданных записей ProposedChange
   */
  async createBatch(
    changes: { objectId: number; changeType: string; proposedData: Record<string, any> }[],
    userId: number
  ): Promise<ProposedChange[]> {
    this.logger.log(`Создание пакета из ${changes.length} предлагаемых изменений от пользователя ${userId}`);

    const entities = changes.map(change =>
      this.proposedChangesRepository.create({
        objectId: change.objectId,
        changeType: change.changeType,
        proposedData: change.proposedData,
        userId,
      })
    );

    const saved = await this.proposedChangesRepository.save(entities);
    this.logger.log(`Создано ${saved.length} записей в proposed_changes`);
    return saved;
  }
}