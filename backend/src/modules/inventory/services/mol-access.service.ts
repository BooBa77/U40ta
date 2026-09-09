import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryBookMolAccess } from '../entities/inventory-book-mol-access.entity';
import { InventoryBookItem } from '../entities/inventory-book-item.entity';
import { InventoryObject } from '../../objects/entities/object.entity';
import { UsersService } from '../../users/users.service';
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

    return [...new Set(accesses.map(a => a.userId))];
  }

  /**
   * Получить строки книги, доступные МОЛу.
   * JOIN inventory_book_mol_access + inventory_book_items + objects.
   * 
   * @param userId - ID МОЛа
   * @returns Массив строк с данными объекта и статусами
   */
  async getMolItems(userId: number): Promise<any[]> {
    // Получаем ID строк из inventory_book_mol_access
    const accesses = await this.repo.find({
      where: { userId },
      select: ['inventoryBookItemId'],
    });

    if (accesses.length === 0) return [];

    const itemIds = accesses.map(a => a.inventoryBookItemId);

    // Получаем строки книги
    const items = await this.itemRepo.find({
      where: { id: In(itemIds) },
    });

    // Получаем объекты для этих строк
    const objectIds = items
      .map(i => i.idObject)
      .filter((id): id is number => id !== null && id !== undefined);

      const objects = objectIds.length > 0
        ? await this.objectRepo.find({ where: { id: In(objectIds) } })
        : [];

    const objectMap = new Map(objects.map(o => [o.id, o]));

    // Формируем результат
    return items.map(item => {
      const obj = item.idObject ? objectMap.get(item.idObject) : null;
      
      return {
        id: item.id,
        zavod: item.zavod,
        sklad: item.sklad,
        invNumber: item.invNumber,
        partyNumber: item.partyNumber,
        buhName: item.buhName,
        isActual: item.isActual,
        isOkManual: item.isOkManual,
        isOkAuto: item.isOkAuto,
        dateOkChecked: item.dateOkAutoChecked || item.dateOkManualChecked,
        rem: item.rem,
        idObject: item.idObject || 0,
        placeTer: obj?.placeTer || null,
        placePos: obj?.placePos || null,
        placeCab: obj?.placeCab || null,
        placeUser: obj?.placeUser || null,
      };
    });
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
  }
}