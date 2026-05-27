import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryStatementsService } from './inventory-statements.service';
import { InventoryStatement } from '../entities/inventory-statement.entity';
import { InventoryBook } from '../entities/inventory-book.entity';
import { InventoryBookItem } from '../entities/inventory-book-item.entity';
import { RevisorAccessService } from './revisor-access.service';
import { AppEventsService } from '../../app-events/app-events.service';

/**
 * Сервис для работы с инвентаризационными книгами.
 * 
 * ## Назначение
 * Управление книгами ревизора: создание из batch'ей, получение,
 * удаление. Все операции проверяют права доступа через RevisorAccessService.
 */
@Injectable()
export class InventoryBooksService {
  private readonly logger = new Logger(InventoryBooksService.name);

  constructor(
    @InjectRepository(InventoryBook)
    private readonly bookRepo: Repository<InventoryBook>,
    @InjectRepository(InventoryBookItem)
    private readonly itemRepo: Repository<InventoryBookItem>,
    private readonly revisorAccessService: RevisorAccessService,
    private readonly inventoryStatementsService: InventoryStatementsService,
    private readonly appEventsService: AppEventsService,
  ) {}

  /**
   * Получить все книги, доступные ревизору.
   * 
   * @param userId - ID пользователя
   * @returns Массив книг с полем isOwner
   */
  async getBooks(userId: number): Promise<(InventoryBook & { isOwner: boolean })[]> {
    const bookIds = await this.revisorAccessService.getBookIdsForUser(userId);

    if (bookIds.length === 0) {
      return [];
    }

    const books = await this.bookRepo.find({
      where: bookIds.map(id => ({ id })),
      order: { createdAt: 'DESC' },
    });

    return books.map(book => ({
      ...book,
      isOwner: book.idOwner === userId,
    }));
  }

  /**
   * Получить одну книгу по ID с проверкой доступа.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @returns Книга
   * @throws ForbiddenException если нет доступа
   * @throws NotFoundException если книга не найдена
   */
  async getBook(bookId: number, userId: number): Promise<InventoryBook> {
    await this.checkAccess(bookId, userId);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена`);
    }

    return book;
  }

  /**
   * Получить все строки книги с проверкой доступа.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @returns Массив строк книги
   * @throws ForbiddenException если нет доступа
   */
  async getBookItems(bookId: number, userId: number): Promise<InventoryBookItem[]> {
    await this.checkAccess(bookId, userId);

    return await this.itemRepo.find({
      where: { idBook: bookId },
      order: { invNumber: 'ASC' },
    });
  }

  /**
   * Создать новую инвентаризационную книгу из выбранных строк.
   * 
   * @param userId - ID пользователя-создателя
   * @param name - Название книги
   * @param items - Массив строк книги (без id, idBook проставится автоматически)
   * @returns Созданная книга
   */
  async createBook(
    userId: number,
    name: string,
    items: Omit<InventoryBookItem, 'id' | 'idBook'>[],
  ): Promise<InventoryBook> {
    // Создаём книгу
    const book = this.bookRepo.create({
      name,
      idOwner: userId,
    });

    const savedBook = await this.bookRepo.save(book);

    // Создаём строки книги
    if (items.length > 0) {
      const bookItems = items.map(item =>
        this.itemRepo.create({
          ...item,
          idBook: savedBook.id,
        }),
      );

      await this.itemRepo.save(bookItems);
      this.logger.log(`Книга ${savedBook.id}: добавлено ${items.length} строк`);
    }

    // Даём создателю доступ
    await this.revisorAccessService.addAccess(savedBook.id, userId);

    this.logger.log(`Создана книга ${savedBook.id} "${name}" пользователем ${userId}`);

    // Уведомляем других ревизоров (если есть команда — пока только создатель)
    this.appEventsService.notifyInventoryBookChanged(savedBook.id);

    return savedBook;
  }

  /**
   * Обновить книгу (название и/или состав строк).
   * Только создатель.
   */
  async updateBook(
    bookId: number,
    userId: number,
    updates: { name?: string; itemIds?: number[] }
  ): Promise<InventoryBook> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена`);
    }

    if (book.idOwner !== userId) {
      throw new ForbiddenException('Только создатель может редактировать книгу');
    }

    // Обновляем название
    if (updates.name !== undefined) {
      book.name = updates.name;
      await this.bookRepo.save(book);
    }

    // Обновляем состав строк
    if (updates.itemIds !== undefined) {
      const itemIds = updates.itemIds;

      // Получаем текущие строки книги
      const currentItems = await this.itemRepo.find({ where: { idBook: bookId } });
      const currentStatementIds = currentItems
        .map(i => i.idInventoryStatement)
        .filter((id): id is number => id !== null);

      // Найти ID для удаления (есть в книге, но нет в новом списке)
      const idsToDelete = currentStatementIds.filter(id => !itemIds.includes(id));

      // Найти ID для добавления (есть в новом списке, но нет в книге)
      const idsToAdd = itemIds.filter(id => !currentStatementIds.includes(id));

      // Удаляем строки
      if (idsToDelete.length > 0) {
        const confirmedItems = currentItems.filter(
          i => i.idInventoryStatement !== null &&
              idsToDelete.includes(i.idInventoryStatement) &&
              (i.isOkManual || i.isOkAuto)
        );

        if (confirmedItems.length > 0) {
          this.logger.warn(
            `Удаление ${confirmedItems.length} подтверждённых строк из книги ${bookId}`
          );
        }

        await this.itemRepo.delete({
          idBook: bookId,
          idInventoryStatement: In(idsToDelete),
        });

        this.logger.log(`Удалено ${idsToDelete.length} строк из книги ${bookId}`);
      }

      // Добавляем новые строки
      if (idsToAdd.length > 0) {
        // Получаем строки из inventory_statements
        const statements = await this.inventoryStatementsService.findByIds(idsToAdd);

        if (statements.length === 0) {
          this.logger.warn(`Не найдены строки inventory_statements для ID: ${idsToAdd.join(', ')}`);
        } else {
          const newItems = statements.map(s =>
            this.itemRepo.create({
              idBook: bookId,
              idInventoryStatement: s.id,
              zavod: s.zavod,
              sklad: s.sklad,
              invNumber: s.invNumber,
              partyNumber: s.partyNumber,
              buhName: s.buhName,
            }),
          );

          await this.itemRepo.save(newItems);
          this.logger.log(`Добавлено ${newItems.length} строк в книгу ${bookId}`);
        }
      }
    }

    const updated = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!updated) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена после обновления`);
    }

    this.appEventsService.notifyInventoryBookChanged(bookId);

    return updated;
  }

  /**
   * Удалить книгу. Только создатель.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @throws ForbiddenException если не создатель
   * @throws NotFoundException если книга не найдена
   */
  async deleteBook(bookId: number, userId: number): Promise<void> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена`);
    }

    if (book.idOwner !== userId) {
      throw new ForbiddenException('Только создатель может удалить книгу');
    }

    await this.bookRepo.delete(bookId);
    this.logger.log(`Книга ${bookId} удалена пользователем ${userId}`);

    this.appEventsService.notifyInventoryBookChanged(bookId);
  }

  /**
   * Проверка доступа пользователя к книге.
   * 
   * @param bookId - ID книги
   * @param userId - ID пользователя
   * @throws ForbiddenException если нет доступа
   */
  private async checkAccess(bookId: number, userId: number): Promise<void> {
    const hasAccess = await this.revisorAccessService.hasAccess(bookId, userId);

    if (!hasAccess) {
      throw new ForbiddenException(`Нет доступа к книге ${bookId}`);
    }
  }

  /**
   * Обновляет статус isActual для всех строк с указанным invNumber в книге
   * @param bookId - ID книги
   * @param invNumber - инвентарный номер
   * @param isActual - новое значение актуальности
   */
  async updateActualStatus(
    bookId: number,
    invNumber: string,
    isActual: boolean
  ): Promise<void> {
    await this.itemRepo.update(
      {
        idBook: bookId,
        invNumber: invNumber,
      },
      {
        isActual: isActual,
      }
    );
    
    this.logger.log(
      `Книга ${bookId}: обновлён isActual=${isActual} для invNumber=${invNumber}`
    );
  }  
}