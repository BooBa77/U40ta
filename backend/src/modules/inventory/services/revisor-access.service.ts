import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevisorAccess } from '../entities/revisor-access.entity';

/**
 * Сервис для управления доступом ревизоров к инвентаризационным книгам.
 * 
 * ## Назначение
 * Управление командой ревизоров для каждой книги:
 * - Добавление/удаление ревизоров
 * - Проверка прав доступа
 * - Получение списка книг пользователя
 */
@Injectable()
export class RevisorAccessService {
  private readonly logger = new Logger(RevisorAccessService.name);

  constructor(
    @InjectRepository(RevisorAccess)
    private readonly repo: Repository<RevisorAccess>,
  ) {}

  /**
   * Добавить ревизору доступ к книге.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @param isOwner - является ли владельцем (по умолчанию false)
   */
  async addAccess(bookId: number, userId: number): Promise<RevisorAccess> {
    const access = this.repo.create({
      idBook: bookId,
      userId,
    });

    const saved = await this.repo.save(access);
    this.logger.log(`Ревизор ${userId} получил доступ к книге ${bookId}`);
    return saved;
  }

  /**
   * Удалить ревизору доступ к книге.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   */
  async removeAccess(bookId: number, userId: number): Promise<void> {
    const result = await this.repo.delete({
      idBook: bookId,
      userId,
    });

    if (result.affected === 0) {
      this.logger.warn(`Доступ ревизора ${userId} к книге ${bookId} не найден`);
      return;
    }

    this.logger.log(`Ревизор ${userId} удалён из книги ${bookId}`);
  }

  /**
   * Получить все ID книг, к которым имеет доступ пользователь.
   * 
   * @param userId - ID пользователя
   * @returns Массив ID книг
   */
  async getBookIdsForUser(userId: number): Promise<number[]> {
    const accesses = await this.repo.find({
      where: { userId },
      select: ['idBook'],
    });

    return accesses.map(a => a.idBook);
  }

  /**
   * Получить все записи доступа к книге.
   * 
   * @param bookId - ID книги
   * @returns Массив записей доступа с userId
   */
  async getAccessForBook(bookId: number): Promise<RevisorAccess[]> {
    return await this.repo.find({
      where: { idBook: bookId },
    });
  }

  /**
   * Проверить, имеет ли пользователь доступ к книге.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @returns true если доступ есть
   */
  async hasAccess(bookId: number, userId: number): Promise<boolean> {
    const count = await this.repo.count({
      where: { idBook: bookId, userId },
    });
    return count > 0;
  }
}