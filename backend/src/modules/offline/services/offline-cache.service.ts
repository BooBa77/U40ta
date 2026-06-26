import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryObject } from 'src/modules/objects/entities/object.entity';
import { Statement } from 'src/modules/statements/entities/statement.entity';
import { QrCode } from 'src/modules/qr-codes/entities/qr-code.entity';
import { MolAccess } from 'src/modules/users/entities/mol-access.entity';
import { InventoryBook } from 'src/modules/inventory/entities/inventory-book.entity';
import { InventoryBookItem } from 'src/modules/inventory/entities/inventory-book-item.entity';
import { RevisorAccess } from 'src/modules/inventory/entities/revisor-access.entity';
import { ProposedChange } from '../../proposed-changes/entities/proposed-change.entity';
import { Photo } from '../../photos/entities/photos.entity';

@Injectable()
export class OfflineCacheService {
  constructor(
    @InjectRepository(Statement)
    private statementsRepository: Repository<Statement>,

    @InjectRepository(InventoryObject)
    private objectsRepository: Repository<InventoryObject>,

    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,

    @InjectRepository(MolAccess)
    private molAccessRepository: Repository<MolAccess>,

    @InjectRepository(InventoryBook)
    private inventoryBookRepo: Repository<InventoryBook>,

    @InjectRepository(InventoryBookItem)
    private inventoryBookItemRepo: Repository<InventoryBookItem>,

    @InjectRepository(RevisorAccess)
    private revisorAccessRepo: Repository<RevisorAccess>,

    @InjectRepository(ProposedChange)
    private proposedChangesRepository: Repository<ProposedChange>,

    @InjectRepository(Photo)
    private photosRepository: Repository<Photo>,    
  ) {}

  /**
   * Собирает данные для офлайн-режима для конкретного пользователя.
   * 
   * @param userId - ID пользователя
   * @returns объект с данными для кэширования на фронте
   */
  async getAllData(userId: number): Promise<any> {
    console.log(`OfflineCacheService: получение данных для пользователя ${userId}`);

    try {
      // 1. Получаем доступные склады пользователя
      const userAccess = await this.molAccessRepository.find({
        where: { userId },
        select: ['zavod', 'sklad'],
      });

      // 2. Получаем ID книг, доступных ревизору
      const revisorAccess = await this.revisorAccessRepo.find({
        where: { userId: userId },
        select: ['idBook'],
      });
      const bookIds = revisorAccess.map(ra => ra.idBook);

      console.log(`OfflineCacheService: пользователь имеет доступ к ${bookIds.length} книгам`);

      // 3. Получаем ВСЕ объекты
      const objects = await this.objectsRepository.find({
        order: { id: 'ASC' },
      });

      // 4. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });

      // 5. Фотографии кэшируем только из proposed_changes
      let photos: Photo[] = [];

      // 6. Получаем инвентаризационные книги и их строки
      let inventoryBooks: InventoryBook[] = [];
      let inventoryBookItems: InventoryBookItem[] = [];

      if (bookIds.length > 0) {
        inventoryBooks = await this.inventoryBookRepo.find({
          where: { id: In(bookIds) },
          order: { id: 'ASC' },
        });

        inventoryBookItems = await this.inventoryBookItemRepo.find({
          where: { idBook: In(bookIds) },
          order: { id: 'ASC' },
        });

        console.log(`OfflineCacheService: загружено книг: ${inventoryBooks.length}, строк: ${inventoryBookItems.length}`);
      }

      // 7. Получаем ведомости пользователя
      let statements: Statement[] = [];

      statements = await this.statementsRepository.find({
        where: { userId },
        order: { id: 'ASC' },
      });

      // 8. Получаем предлагаемые изменения для складов МОЛа
      let proposedChanges: ProposedChange[] = [];

      if (userAccess.length > 0) {
        // Формируем массив условий zavod/sklad для SQL-фильтрации
        const accessConditions = userAccess.map(a => ({ zavod: a.zavod, sklad: a.sklad }));
        
        const entities = await this.proposedChangesRepository
          .createQueryBuilder('pc')
          // Джойним objects, потому что у proposed_changes нет zavod/sklad — они есть только в objects
          .innerJoin('pc.object', 'obj')
          .where(
            // Строим SQL: (obj.zavod = :zavod0 AND obj.sklad = :sklad0) OR (obj.zavod = :zavod1 AND ...)
            accessConditions
              .map((_, i) => `(obj.zavod = :zavod${i} AND obj.sklad = :sklad${i})`)
              .join(' OR '),
            // Подставляем значения: { zavod0: 1, sklad0: 'А', zavod1: 2, sklad1: 'Б' }
            accessConditions.reduce((params, a, i) => ({
              ...params,
              [`zavod${i}`]: a.zavod,
              [`sklad${i}`]: a.sklad,
            }), {})
          )
          // Сначала новые
          .orderBy('pc.created_at', 'DESC')
          .getMany();

        // Преобразуем поля сущности из snake_case БД в camelCase для фронтового Dexie
        proposedChanges = entities.map(pc => ({
          id: pc.id,
          objectId: pc.objectId,
          changeType: pc.changeType,
          proposedData: pc.proposedData,
          userId: pc.userId,
          userAbr: pc.userAbr,
          objectBuhName: pc.objectBuhName,
          objectInvNumber: pc.objectInvNumber,
          objectSn: pc.objectSn,
          photoId: pc.photoId,
          createdAt: pc.createdAt,
        })) as ProposedChange[];
        
        console.log(`OfflineCacheService: загружено proposed_changes: ${proposedChanges.length}`);
      }
      // 8.1. Собираем фото из proposed_changes
      const photoIds = proposedChanges
        .map(pc => pc.photoId)
        .filter((id): id is number => id !== null && id !== undefined);

      if (photoIds.length > 0) {
        photos = await this.photosRepository.find({
          where: { id: In(photoIds) }
        });
        console.log(`OfflineCacheService: загружено proposed-фото: ${photos.length}`);
      }      

      // 9. Формируем ответ
      return {
        objects: objects,
        statements: statements,
        qr_codes: qrCodes,
        photos: photos,
        proposed_changes: proposedChanges,
        inventory_books: inventoryBooks,
        inventory_book_items: inventoryBookItems,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalStatements: statements.length,
          totalObjects: objects.length,
          totalQrCodes: qrCodes.length,
          totalInventoryBooks: inventoryBooks.length,
          totalInventoryBookItems: inventoryBookItems.length,
        }
      };
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }
}