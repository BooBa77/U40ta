import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryStatement } from '../entities/inventory-statement.entity';

/**
 * Сервис для работы инвентаризационными ведомостями из таблиц, пришедших по e-mail.
 * 
 * ## Назначение
 * Получение batch'ей (пакетов строк из одного файла по складу) и отдельных строк,
 * удаление batch'ей. Используется в модалке ревизора для формирования книг.
 */
@Injectable()
export class InventoryStatementsService {
  private readonly logger = new Logger(InventoryStatementsService.name);

  constructor(
    @InjectRepository(InventoryStatement)
    private readonly repo: Repository<InventoryStatement>,
  ) {}

  /**
   * Получить список уникальных batch'ей ревизора.
   * Группирует строки по emailFrom + receivedAt + zavod + sklad.
   * 
   * @param email - email ревизора из JWT
   * @returns Массив batch'ей с количеством строк в каждом
   */
  async getBatches(email: string): Promise<{
    emailFrom: string;
    receivedAt: Date;
    zavod: number;
    sklad: string;
    docType: string;
    count: number;
  }[]> {
    const result = await this.repo
      .createQueryBuilder('s')
      .select('s.emailFrom', 'emailFrom')
      .addSelect('s.receivedAt', 'receivedAt')
      .addSelect('s.zavod', 'zavod')
      .addSelect('s.sklad', 'sklad')
      .addSelect('s.docType', 'docType')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.emailFrom = :email', { email })
      .groupBy('s.emailFrom')
      .addGroupBy('s.receivedAt')
      .addGroupBy('s.zavod')
      .addGroupBy('s.sklad')
      .addGroupBy('s.docType')
      .orderBy('s.receivedAt', 'DESC')
      .getRawMany();

    return result;
  }

  /**
   * Получить строки inventory_statements по массиву ID.
   * Используется InventoryBooksService для копирования строк в книгу.
   * 
   * @param ids - Массив ID строк inventory_statements
   * @returns Массив найденных строк
   */
  async findByIds(ids: number[]): Promise<InventoryStatement[]> {
    if (ids.length === 0) return [];
    
    return await this.repo.find({
      where: ids.map(id => ({ id })),
    });
  }

  /**
   * Получить все строки конкретного batch'а.
   * 
   * @param email - email ревизора
   * @param receivedAt - дата получения batch'а
   * @param zavod - номер завода
   * @param sklad - код склада
   * @returns Массив строк InventoryStatement
   */
  async getBatchItems(
    email: string,
    receivedAt: Date,
    zavod: number,
    sklad: string
  ): Promise<InventoryStatement[]> {
    return await this.repo.find({
      where: {
        emailFrom: email,
        receivedAt: receivedAt,
        zavod: zavod,
        sklad: sklad
      },
      order: {
        invNumber: 'ASC'
      }
    });
  }

  /**
   * Удалить все строки конкретного batch'а.
   * 
   * @param email - email ревизора
   * @param receivedAt - дата получения batch'а
   * @param zavod - номер завода
   * @param sklad - код склада
   */
  async deleteBatch(
    email: string,
    receivedAt: Date,
    zavod: number,
    sklad: string
  ): Promise<void> {
    const result = await this.repo.delete({
      emailFrom: email,
      receivedAt: receivedAt,
      zavod: zavod,
      sklad: sklad
    });

    if (result.affected === 0) {
      throw new NotFoundException('Пакет не найден');
    }

    this.logger.log(
      `Удалён пакет: email=${email}, receivedAt=${receivedAt.toISOString()}, ` +
      `zavod=${zavod}, sklad=${sklad}, строк: ${result.affected}`
    );
  }
}