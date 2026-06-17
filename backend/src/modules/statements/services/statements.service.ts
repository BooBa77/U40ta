import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Statement } from '../entities/statement.entity';
import { InventoryObject } from '../../objects/entities/object.entity';

/**
 * Сервис для работы с ведомостями МОЛ.
 * 
 * ## Назначение
 * Получение списка ведомостей, строк конкретной ведомости,
 * удаление ведомостей, поиск записей по инвентарному номеру,
 * обновление флагов haveObject, isActual, isExcess.
 */
@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepo: Repository<Statement>,

    @InjectRepository(InventoryObject)
    private readonly objectRepo: Repository<InventoryObject>,
  ) {}

  // ============================================================================
  // ПОЛУЧЕНИЕ СПИСКА ВЕДОМОСТЕЙ
  // ============================================================================

  /**
   * Получить список ведомостей МОЛ.
   * Группирует строки по user_id + received_at + description.
   * 
   * @param userId - ID пользователя (МОЛ)
   * @returns Массив ведомостей с количеством строк в каждой
   */
  async getList(userId: number): Promise<{
    receivedAt: Date;
    description: string;
    docType: string;
    count: number;
  }[]> {
    const result = await this.statementRepo
      .createQueryBuilder('s')
      .select('s.receivedAt', 'receivedAt')
      .addSelect('s.description', 'description')
      .addSelect('s.docType', 'docType')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.userId = :userId', { userId })
      .groupBy('s.receivedAt')
      .addGroupBy('s.description')
      .addGroupBy('s.docType')
      .orderBy('s.receivedAt', 'DESC')
      .getRawMany();

    return result;
  }

  // ============================================================================
  // ПОЛУЧЕНИЕ СТРОК ВЕДОМОСТИ
  // ============================================================================

  /**
   * Получить все строки конкретной ведомости с подсчётом связанных объектов.
   * Для каждой строки вычисляет objectCount — количество реальных объектов
   * в таблице objects с теми же zavod, sklad, invNumber, partyNumber.
   * 
   * @param userId - ID пользователя (МОЛ)
   * @param receivedAt - дата получения ведомости
   * @returns Массив строк Statement с дополнительным полем objectCount
   */
  async getItems(
    userId: number,
    receivedAt: Date
  ): Promise<(Statement & { objectCount: number })[]> {
    const result = await this.statementRepo
      .createQueryBuilder('s')
      .leftJoin(
        'objects',
        'o',
        'o.zavod = s.zavod AND o.sklad = s.sklad AND o.inv_number = s.inv_number AND o.party_number = s.party_number AND o.is_written_off = false'
      )
      .select('s.*')
      .addSelect('COUNT(o.id)', 'objectCount')
      .where('s.userId = :userId', { userId })
      .andWhere('s.receivedAt = :receivedAt', { receivedAt })
      .andWhere('s.isActual = true')
      .groupBy('s.id')
      .addGroupBy('s.zavod')
      .addGroupBy('s.sklad')
      .addGroupBy('s.invNumber')
      .addGroupBy('s.partyNumber')
      .orderBy('s.invNumber', 'ASC')
      .getRawMany();

    return result.map(row => ({
      id: row.id,
      userId: row.user_id,
      receivedAt: row.received_at,
      docType: row.doc_type,
      description: row.description,
      zavod: row.zavod,
      sklad: row.sklad,
      invNumber: row.inv_number,
      partyNumber: row.party_number,
      buhName: row.buh_name,
      isActual: row.is_actual,
      objectCount: Number(row.objectCount),
    }));
  }

  // ============================================================================
  // УДАЛЕНИЕ ВЕДОМОСТИ
  // ============================================================================

  /**
   * Удалить все строки ведомости.
   * 
   * @param userId - ID пользователя (МОЛ)
   * @param receivedAt - дата получения ведомости
   */
  async deleteStatement(
    userId: number,
    receivedAt: Date
  ): Promise<void> {
    const result = await this.statementRepo.delete({
      userId,
      receivedAt,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Ведомость не найдена');
    }

    this.logger.log(
      `Удалена ведомость: userId=${userId}, receivedAt=${receivedAt.toISOString()}, строк: ${result.affected}`
    );
  }

  // ============================================================================
  // ПОИСК ПО ИНВЕНТАРНОМУ НОМЕРУ
  // ============================================================================

  /**
   * Поиск записей ведомости по инвентарному номеру.
   * Возвращает только записи с haveObject = false (объект ещё не создан).
   * 
   * @param invNumber - инвентарный номер
   * @param zavod - номер завода (опционально)
   * @param sklad - код склада (опционально)
   * @param partyNumber - номер партии (опционально)
   * @returns Массив найденных строк
   */
  async findByInv(
    invNumber: string,
    zavod?: number,
    sklad?: string,
    partyNumber?: string
  ): Promise<Statement[]> {
    const queryBuilder = this.statementRepo
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

  // ============================================================================
  // ОБНОВЛЕНИЕ АКТУАЛЬНОСТИ
  // ============================================================================

  /**
   * Обновляет статус isActual для всех строк с указанным invNumber в ведомости.
   * 
   * @param userId - ID пользователя (МОЛ)
   * @param receivedAt - дата получения ведомости
   * @param invNumber - инвентарный номер
   * @param isActual - новое значение актуальности
   * @returns Количество обновлённых записей
   */
  async updateActual(
    userId: number,
    receivedAt: Date,
    invNumber: string,
    isActual: boolean
  ): Promise<number> {
    const result = await this.statementRepo.update(
      {
        userId,
        receivedAt,
        invNumber,
      },
      { isActual }
    );

    this.logger.log(
      `Обновлён isActual=${isActual} для invNumber=${invNumber}, ` +
      `userId=${userId}, receivedAt=${receivedAt.toISOString()}, затронуто строк: ${result.affected}`
    );

    return result.affected || 0;
  }
}