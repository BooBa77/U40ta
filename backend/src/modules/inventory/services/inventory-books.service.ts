import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryStatementsService } from './inventory-statements.service';
import { InventoryStatement } from '../entities/inventory-statement.entity';
import { InventoryBook } from '../entities/inventory-book.entity';
import { InventoryBookItem } from '../entities/inventory-book-item.entity';
import { RevisorAccessService } from './revisor-access.service';
import { AppEventsService } from '../../app-events/app-events.service';
import * as XLSX from 'xlsx';
import { SmtpService } from '../../email/services/smtp.service';
import { UsersService } from 'src/modules/users/users.service';

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
    private readonly smtpService: SmtpService,
    private readonly usersService: UsersService,
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
  async getBook(bookId: number, userId: number): Promise<InventoryBook & { isOwner: boolean }> {
    await this.checkAccess(bookId, userId);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });

    if (!book) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена`);
    }

    return { ...book, isOwner: book.idOwner === userId };
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

  /**
   * Подтверждает наличие для указанных строк книги.
   * Заполняет поля isOkManual/isOkAuto, даты, комментарий и снимок местоположения.
   * 
   * @param bookId - ID книги
   * @param itemIds - ID строк для подтверждения
   * @param userId - ID пользователя
   * @param data - данные подтверждения
   */
  async confirmItems(
    bookId: number,
    itemIds: number[],
    userId: number,
    data: {
      isOkManual?: boolean;
      isOkAuto?: boolean;
      rem?: string | null;
      idObject?: number | null;
      placeTer?: string | null;
      placePos?: string | null;
      placeCab?: string | null;
      placeUser?: string | null;
    }
  ): Promise<{ success: boolean; confirmedCount: number }> {
    const updateData: Partial<InventoryBookItem> = {};

    if (data.isOkManual !== undefined) {
      updateData.isOkManual = data.isOkManual;
      updateData.idUserOkManualChecked = data.isOkManual ? userId : null;
      updateData.dateOkManualChecked = data.isOkManual ? new Date() : null;
    }

    if (data.isOkAuto !== undefined) {
      updateData.isOkAuto = data.isOkAuto;
      updateData.idUserOkAutoChecked = data.isOkAuto ? userId : null;
      updateData.dateOkAutoChecked = data.isOkAuto ? new Date() : null;
    }

    if (data.rem !== undefined) {
      updateData.rem = data.rem;
    }

    if (data.idObject !== undefined) {
      updateData.idObject = data.idObject;
    }

    if (data.placeTer !== undefined) {
      updateData.placeTer = data.placeTer;
      updateData.placePos = data.placePos;
      updateData.placeCab = data.placeCab;
      updateData.placeUser = data.placeUser;
    }

    const result = await this.itemRepo.update(
      { idBook: bookId, id: In(itemIds) },
      updateData
    );

    const confirmedCount = result.affected ?? 0;

    this.logger.log(
      `Книга ${bookId}: подтверждено ${confirmedCount} строк, userId=${userId}, ` +
      `isOkManual=${data.isOkManual}, isOkAuto=${data.isOkAuto}`
    );

    return { success: true, confirmedCount };
  }

  // ============================================================================
  // ВЫГРУЗКА КНИГИ В EXCEL
  // ============================================================================

  /**
   * Выгрузить книгу в Excel и отправить файл на почту пользователю.
   * 
   * ## Процесс
   * 1. Проверяет доступ пользователя к книге
   * 2. Получает книгу и все её строки
   * 3. Собирает уникальные ID ревизоров, получает их аббревиатуры через UsersService
   * 4. Формирует массив строк для Excel с читаемыми заголовками
   * 5. Создаёт Excel-файл в Buffer через библиотеку xlsx
   * 6. Настраивает ширину колонок под содержимое
   * 7. Отправляет файл на email пользователя через SmtpService
   * 
   * ## Формат Excel
   * 17 колонок: Завод, Склад, Инвентарный номер, Партия, Название,
   * Территория, Позиция, Кабинет, Пользователь, Участвует,
   * Подтверждено (ручное), Ревизор, Дата (ручное),
   * Подтверждено (авто), Ревизор (авто), Дата (авто), Примечание
   * 
   * ## Имя файла
   * Формат: НазваниеКниги_ГГГГММДДЧЧММ.xlsx
   * Недопустимые символы в названии заменяются на '_'
   * 
   * @param bookId - ID книги для выгрузки
   * @param userId - ID пользователя (для проверки доступа)
   * @param userEmail - email пользователя-получателя
   * @returns Объект с результатом: success и сообщение
   * @throws ForbiddenException если нет доступа
   * @throws NotFoundException если книга не найдена
   */
  async exportBookToExcel(
    bookId: number,
    userId: number,
    userEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    // ========== Шаг 1: Проверяем доступ ==========
    await this.checkAccess(bookId, userId);

    // ========== Шаг 2: Получаем книгу и строки ==========
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(`Книга с ID ${bookId} не найдена`);
    }

    const items = await this.getBookItems(bookId, userId);

    if (items.length === 0) {
      return { success: false, message: 'Книга пуста' };
    }

    // ========== Шаг 3: Собираем аббревиатуры ревизоров ==========
    // Уникальные ID из полей ручного и автоматического подтверждения
    const userIds = new Set<number>();
    for (const item of items) {
      if (item.idUserOkManualChecked) userIds.add(item.idUserOkManualChecked);
      if (item.idUserOkAutoChecked) userIds.add(item.idUserOkAutoChecked);
    }

    // Кэш id -> abr (при ошибке используем id как строку)
    const abrMap = new Map<number, string>();
    for (const uid of userIds) {
      try {
        const user = await this.usersService.findById(uid);
        abrMap.set(uid, user?.abr || String(uid));
      } catch {
        abrMap.set(uid, String(uid));
      }
    }

    // ========== Шаг 4: Описываем колонки Excel ==========
    const columns = [
      { key: 'zavod',            header: 'Завод' },
      { key: 'sklad',            header: 'Склад' },
      { key: 'invNumber',        header: 'Инвентарный номер' },
      { key: 'partyNumber',      header: 'Партия' },
      { key: 'buhName',          header: 'Название' },
      { key: 'placeTer',         header: 'Территория' },
      { key: 'placePos',         header: 'Позиция' },
      { key: 'placeCab',         header: 'Кабинет' },
      { key: 'placeUser',        header: 'Пользователь' },
      { key: 'isActual',         header: 'Участвует' },
      { key: 'isOkManual',       header: 'Подтверждено (ручное)' },
      { key: 'revisorManual',    header: 'Ревизор' },
      { key: 'dateManual',       header: 'Дата (ручное)' },
      { key: 'isOkAuto',         header: 'Подтверждено (авто)' },
      { key: 'revisorAuto',      header: 'Ревизор (авто)' },
      { key: 'dateAuto',         header: 'Дата (авто)' },
      { key: 'rem',              header: 'Примечание' },
    ];

    // ========== Шаг 5: Формируем строки данных ==========
    const rows = items.map(item => ({
      zavod:           item.zavod,
      sklad:           item.sklad,
      invNumber:       item.invNumber,
      partyNumber:     item.partyNumber || '',
      buhName:         item.buhName,
      placeTer:        item.placeTer || '',
      placePos:        item.placePos || '',
      placeCab:        item.placeCab || '',
      placeUser:       item.placeUser || '',
      isActual:        item.isActual ? 'Да' : 'Нет',
      isOkManual:      item.isOkManual ? 'Да' : 'Нет',
      revisorManual:   item.idUserOkManualChecked ? (abrMap.get(item.idUserOkManualChecked) || '') : '',
      dateManual:      item.dateOkManualChecked ? this.formatDate(item.dateOkManualChecked) : '',
      isOkAuto:        item.isOkAuto ? 'Да' : 'Нет',
      revisorAuto:     item.idUserOkAutoChecked ? (abrMap.get(item.idUserOkAutoChecked) || '') : '',
      dateAuto:        item.dateOkAutoChecked ? this.formatDate(item.dateOkAutoChecked) : '',
      rem:             item.rem || '',
    }));

    // ========== Шаг 6: Создаём Excel-лист ==========
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.key) });

    // Заменяем ключи на читаемые заголовки в первой строке
    XLSX.utils.sheet_add_aoa(worksheet, [columns.map(c => c.header)], { origin: 'A1' });

    // ========== Шаг 7: Настраиваем ширину колонок ==========
    const colWidths = columns.map((col, colIndex) => {
      let maxLen = col.header.length;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const val = rows[rowIndex][col.key];
        const len = String(val ?? '').length;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet['!cols'] = colWidths;

    // ========== Шаг 8: Создаём книгу и пишем в Buffer ==========
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Инвентаризация');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // DEBUG
    this.logger.log(`Excel buffer size: ${buffer.length} bytes, rows: ${items.length}`);    

    // ========== Шаг 9: Формируем имя файла ==========
    const now = new Date();
    const timestamp =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    // Заменяем недопустимые символы в названии книги
    const safeName = book.name.replace(/[^a-zA-Zа-яА-Я0-9 _-]/g, '_');
    const filename = `${safeName}_${timestamp}.xlsx`;

    // ========== Шаг 10: Отправляем письмо с вложением ==========
    const result = await this.smtpService.sendEmail(
      'booba@yandex.ru',
      //userEmail,
      `Выгрузка инвентаризации: ${book.name} для ${userEmail}`,
      `Инвентаризационная книга "${book.name}" во вложении.\n\n` +
      `Сформировано: ${now.toLocaleString('ru-RU')}`,
      [
        {
          filename,
          content: buffer,
        },
      ],
    );

    this.logger.log(
      `Книга ${bookId} выгружена в Excel и отправлена на ${userEmail}`
    );

    return {
      success: result.success,
      message: result.success ? 'Направлено Вам на почту' : 'Ошибка при отправке',
    };
  }

  /**
   * Форматировать дату для Excel в формате ДД.ММ.ГГГГ ЧЧ:ММ.
   * 
   * @param date - объект Date или строка даты
   * @returns Отформатированная строка
   */
  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }  

}