import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryBookMolAccess } from '../entities/inventory-book-mol-access.entity';
import { InventoryBookItem } from '../entities/inventory-book-item.entity';
import { InventoryObject } from '../../objects/entities/object.entity';
import { UsersService } from '../../users/users.service';
import { AppEventsService } from '../../app-events/app-events.service';
import { User } from '../../users/entities/user.entity';

/**
 * Сервис для управления доступом МОЛов к строкам инвентаризационной книги.
 * 
 * ## Назначение
 * Расшаривание строк книги для МОЛов на основе их доступа к складам (mol_access).
 * МОЛ видит только те строки, которые ему явно расшарили.
 */
@Injectable()
export class MolAccessService {
  private readonly logger = new Logger(MolAccessService.name);

  constructor(
    @InjectRepository(InventoryBookMolAccess)
    private readonly repo: Repository<InventoryBookMolAccess>,
    @InjectRepository(InventoryBookItem)
    private readonly itemRepo: Repository<InventoryBookItem>,
    @InjectRepository(InventoryObject)
    private readonly objectRepo: Repository<InventoryObject>,
    private readonly usersService: UsersService,
    private readonly appEventsService: AppEventsService,
  ) {}

  /**
   * Получить список МОЛов, чьи склады пересекаются со складами строк книги.
   * 
   * @param bookId - ID книги
   * @returns Массив пользователей-МОЛов
   */
  async getMolCandidates(bookId: number): Promise<User[]> {
    // Получаем все строки книги
    const items = await this.itemRepo.find({
      where: { idBook: bookId },
      select: ['zavod', 'sklad'],
    });

    if (items.length === 0) {
      this.logger.warn(`Книга ${bookId} не содержит строк`);
      return [];
    }

    // Собираем уникальные пары zavod + sklad
    const locations = [...new Map(
      items.map(i => [`${i.zavod}|${i.sklad}`, { zavod: i.zavod, sklad: i.sklad }])
    ).values()];

    // Получаем МОЛов, имеющих доступ к этим складам
    return await this.usersService.findMolsByLocations(locations);
  }

  /**
   * Расшарить строки книги для МОЛов.
   * Для каждого МОЛа определяет доступные строки по его mol_access (zavod + sklad).
   * 
   * @param bookId - ID книги
   * @param userIds - массив ID МОЛов для расшаривания
   * @returns Количество созданных записей доступа
   */
  async shareBookItems(bookId: number, userIds: number[]): Promise<number> {
    // Получаем все строки книги
    const items = await this.itemRepo.find({
      where: { idBook: bookId },
      select: ['id', 'zavod', 'sklad'],
    });

    if (items.length === 0) {
      this.logger.warn(`Книга ${bookId} не содержит строк для расшаривания`);
      return 0;
    }

    let createdCount = 0;

    // Для каждого МОЛа
    for (const userId of userIds) {
      // Получаем доступные склады МОЛа
      const molAccess = await this.usersService.getMolAccess(userId);
      
      // Для каждой строки книги проверяем, есть ли доступ у МОЛа к этому складу
      for (const item of items) {
        const hasAccess = molAccess.some(
          ma => ma.zavod === item.zavod && ma.sklad === item.sklad
        );
        
        if (hasAccess) {
          // Проверяем, нет ли уже такой записи
          const exists = await this.repo.findOne({
            where: { userId, inventoryBookItemId: item.id },
          });
          
          if (!exists) {
            await this.repo.save({
              userId,
              inventoryBookItemId: item.id,
            });
            createdCount++;
          }
        }
      }

      // Уведомляем МОЛа об изменении доступа
      this.appEventsService.notifyMolAccessChanged(userId);
    }
    
    this.logger.log(`Расшарено ${createdCount} строк книги ${bookId}`);
    return createdCount;
  }

  /**
   * Получить список ID МОЛов, которым расшарены строки книги.
   * 
   * @param bookId - ID книги
   * @returns Массив ID пользователей-МОЛов
   */
  async getMolIdsForBook(bookId: number): Promise<number[]> {
    // Получаем все строки книги
    const items = await this.itemRepo.find({
      where: { idBook: bookId },
      select: ['id'],
    });

    if (items.length === 0) return [];

    const itemIds = items.map(i => i.id);

    const accesses = await this.repo.find({
      where: { inventoryBookItemId: In(itemIds) },
      select: ['userId'],
    });

    return [...new Set(accesses.map(a => Number(a.userId)))];
  }

  /**
   * Получить строки книги, доступные МОЛу, с цветовой индикацией.
   * 
   * ## Алгоритм
   * 1. Получаем itemIds из inventory_book_mol_access по userId
   * 2. Загружаем строки inventory_book_items
   * 3. Группируем по комбинации invNumber|partyNumber|zavod|sklad
   * 4. Для каждой группы:
   *    - Шаг 1: если isActual = false → возвращаем items как есть (серые)
   *    - Шаг 2: подтверждённые (isOkAuto ИЛИ isOkManual) — зелёные
   *    - Шаг 3: неподтверждённые — чёрные/красные/синие по количеству
   *    - Шаг 4: контрольный запрос оставшихся objects — синие
   * 
   * @param userId - ID МОЛа
   * @returns Массив строк с данными объекта, статусами и isExcess
   */
  async getMolItems(userId: number): Promise<any[]> {
    // Запрос 1: получаем ID строк из inventory_book_mol_access
    const accesses = await this.repo.find({
      where: { userId },
      select: ['inventoryBookItemId'],
    });

    if (accesses.length === 0) return [];

    const itemIds = accesses.map(a => a.inventoryBookItemId);

    // Запрос 2: получаем строки книги
    const items = await this.itemRepo.find({
      where: { id: In(itemIds) },
    });

    if (items.length === 0) return [];

    // Группируем по комбинации
    const groups = new Map<string, InventoryBookItem[]>();
    for (const item of items) {
      const key = `${item.invNumber}|${item.partyNumber || ''}|${item.zavod}|${item.sklad}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    const result: any[] = [];

    // Обрабатываем каждую группу
    for (const [key, groupItems] of groups) {
      const [invNumber, partyNumber, zavodStr, sklad] = key.split('|');
      const zavod = Number(zavodStr);

      // Шаг 1: неактуальные
      const inactiveItems = groupItems.filter(i => !i.isActual);
      if (inactiveItems.length > 0) {
        for (const item of inactiveItems) {
          result.push(this.buildResultItem(item, null, false));
        }
      }

      // Активные
      const activeItems = groupItems.filter(i => i.isActual);
      if (activeItems.length === 0) continue;

      // A[] — локальный массив занятых idObject для группы
      const usedObjectIds = new Set<number>();

      // Шаг 2: подтверждённые (isOkAuto ИЛИ isOkManual)
      const confirmedItems = activeItems.filter(i => i.isOkAuto || i.isOkManual);
      for (const item of confirmedItems) {
        let obj: InventoryObject | null = null;
        
        if (item.idObject) {
          obj = await this.objectRepo.findOne({ where: { id: item.idObject } });
          if (obj) {
            usedObjectIds.add(obj.id);
          }
        }

        result.push(this.buildResultItem(item, obj, false));
      }

      // Шаг 3: неподтверждённые (isOkAuto = false И isOkManual = false)
      const unconfirmedItems = activeItems.filter(i => !i.isOkAuto && !i.isOkManual);
      
      if (unconfirmedItems.length > 0) {
        // Ищем objects по комбинации, исключая уже занятые
        const allObjects = await this.objectRepo.find({
          where: { invNumber, partyNumber, zavod, sklad },
        });
        
        const availableObjects = allObjects.filter(o => !usedObjectIds.has(o.id));

        const N = unconfirmedItems.length;
        const M = availableObjects.length;

        if (M < N) {
          // M чёрных + (N-M) красных
          for (let i = 0; i < N; i++) {
            if (i < M) {
              const obj = availableObjects[i];
              usedObjectIds.add(obj.id);
              result.push(this.buildResultItem(unconfirmedItems[i], obj, false));
            } else {
              result.push(this.buildResultItem(unconfirmedItems[i], null, false));
            }
          }
        } else if (M === N) {
          // Все чёрные
          for (let i = 0; i < N; i++) {
            const obj = availableObjects[i];
            usedObjectIds.add(obj.id);
            result.push(this.buildResultItem(unconfirmedItems[i], obj, false));
          }
        } else {
          // M > N → все M синих
          for (const obj of availableObjects) {
            usedObjectIds.add(obj.id);
            result.push(this.buildExcessItem(obj, invNumber, partyNumber, zavod, sklad));
          }
        }
      }

      // Шаг 4: контрольный запрос — оставшиеся objects по комбинации
      const remainingObjects = await this.objectRepo.find({
        where: { invNumber, partyNumber, zavod, sklad },
      });

      for (const obj of remainingObjects) {
        if (!usedObjectIds.has(obj.id)) {
          usedObjectIds.add(obj.id);
          result.push(this.buildExcessItem(obj, invNumber, partyNumber, zavod, sklad));
        }
      }
    }

    return result;
  }

  /**
   * Формирует элемент результата на основе строки книги.
   * 
   * @param item - строка книги
   * @param obj - найденный объект (или null)
   * @param isExcess - признак излишка
   * @returns Объект для фронта
   */
  private buildResultItem(
    item: InventoryBookItem,
    obj: InventoryObject | null,
    isExcess: boolean,
  ): any {
    return {
      id: item.id,
      zavod: item.zavod,
      sklad: item.sklad,
      invNumber: item.invNumber,
      partyNumber: item.partyNumber,
      buhName: item.buhName,
      isActual: item.isActual,
      isOk:  item.isOkManual || item.isOkAuto,
      dateOkChecked: item.dateOkAutoChecked || item.dateOkManualChecked,
      rem: item.rem,
      idObject: obj?.id || item.idObject || 0,
      placeTer: obj?.placeTer || item.placeTer || null,
      placePos: obj?.placePos || item.placePos || null,
      placeCab: obj?.placeCab || item.placeCab || null,
      placeUser: obj?.placeUser || item.placeUser || null,
      sn: obj?.sn || null,
      isExcess,
    };
  }

  /**
   * Формирует элемент результата для объекта-излишка.
   * 
   * @param obj - объект из objects
   * @param invNumber - инвентарный номер
   * @param partyNumber - партия
   * @param zavod - завод
   * @param sklad - склад
   * @returns Объект для фронта с isExcess = true
   */
  private buildExcessItem(
    obj: InventoryObject,
    invNumber: string,
    partyNumber: string,
    zavod: number,
    sklad: string,
  ): any {
    return {
      id: null,
      zavod,
      sklad,
      invNumber,
      partyNumber,
      buhName: obj.buhName,
      isActual: true,
      isOk: false,
      dateOkChecked: null,
      rem: null,
      idObject: obj.id,
      placeTer: obj.placeTer || null,
      placePos: obj.placePos || null,
      placeCab: obj.placeCab || null,
      placeUser: obj.placeUser || null,
      sn: obj.sn || null,
      isExcess: true,
    };
  }

  /**
   * Удалить доступ МОЛа ко всем строкам книги.
   * 
   * @param bookId - ID книги
   * @param userId - ID МОЛа
   */
  async removeMolAccess(bookId: number, userId: number): Promise<void> {
    const items = await this.itemRepo.find({
      where: { idBook: bookId },
      select: ['id'],
    });

    if (items.length === 0) return;

    const itemIds = items.map(i => i.id);

    await this.repo.delete({
      userId,
      inventoryBookItemId: In(itemIds),
    });

    this.logger.log(`Удалён доступ МОЛа ${userId} к строкам книги ${bookId}`);

    // Уведомляем МОЛа об изменении доступа
    this.appEventsService.notifyMolAccessChanged(userId);
  }
}