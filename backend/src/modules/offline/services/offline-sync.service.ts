import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ObjectsService } from '../../objects/services/objects.service';
import { LogsService } from '../../logs/logs.service';
import { UsersService } from '../../users/users.service';
import { PhotosService } from '../../photos/photos.service';
import { ProposedChangesService } from '../../proposed-changes/proposed-changes.service';
import { SyncChangesRequestDto } from '../dto/sync-changes.request.dto';
import { CreateObjectDto } from '../../objects/dto/create-object.dto';
import { UpdateObjectDto } from '../../objects/dto/update-object.dto';
import { InventoryBookItem } from '../../inventory/entities/inventory-book-item.entity';
import { InventoryBook } from '../../inventory/entities/inventory-book.entity';
import { ProposedChange } from '../../proposed-changes/entities/proposed-change.entity';

/**
 * Сервис синхронизации изменений из офлайн-режима.
 * 
 * ## Назначение
 * Применяет изменения, сделанные пользователем в офлайн-режиме, к онлайн-базе данных.
 * 
 * ## Логика обработки объектов
 * Для каждого объекта из пакета синхронизации:
 * - Проверяется доступ пользователя к складу объекта (МОЛ / неМОЛ).
 * - Новые объекты (id < 0) может создавать только МОЛ. НеМОЛ пропускается.
 * - Если пользователь МОЛ — изменения применяются напрямую к объекту (create / update).
 * - Если пользователь неМОЛ — изменения трансформируются в предлагаемые (proposed_changes)
 *   для последующего рассмотрения МОЛом.
 * 
 * ## Логика обработки инвентаризационных книг
 * Для каждой строки книги сверяются даты подтверждений (ручного и автоматического).
 * Побеждает более свежее подтверждение. Данные объекта в строке обновляются,
 * если хотя бы одно подтверждение свежее.
 * 
 * ## Логика обработки proposed_changes
 * Записи, явно присланные фронтом как предложения (action: 'create' / 'delete'),
 * создаются или удаляются. При удалении делегирует в ProposedChangesService.remove,
 * который проверяет photo_id и решает судьбу связанного фото.
 */
@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly objectsService: ObjectsService,
    private readonly logsService: LogsService,
    private readonly usersService: UsersService,
    private readonly photosService: PhotosService,
    private readonly proposedChangesService: ProposedChangesService,
  ) {}

  /**
   * Применяет изменения из офлайн-режима в одной транзакции.
   * 
   * ## Порядок обработки
   * 1. Обработка объектов — создание/обновление для МОЛа, proposed_changes для неМОЛа.
   *    Новые объекты (id < 0) от неМОЛа пропускаются.
   * 2. Обработка строк инвентаризационных книг — сверка дат подтверждений.
   * 3. Обработка явных proposed_changes — создание/удаление предложений.
   * 
   * @param userId — ID пользователя, выполняющего синхронизацию
   * @param dto — DTO с изменениями (changes, inventoryBookItemChanges, proposedChangeActions)
   * @returns количество обработанных объектов и строк книг
   */
  async applyChanges(
    userId: number,
    dto: SyncChangesRequestDto,
  ): Promise<{ processed: number; inventoryItemsProcessed: number }> {
    console.log(
      `[OfflineSyncService] Применяем ${dto.changes.length} изменений объектов ` +
      `и ${dto.inventoryBookItemChanges?.length || 0} строк книг для userId=${userId}`,
    );

    let processed = 0;
    let inventoryItemsProcessed = 0;

    await this.entityManager.transaction(async (manager) => {
      // ========================================================================
      // 1. ОБРАБОТКА ОБЪЕКТОВ
      // ========================================================================
      for (const obj of dto.changes) {
        const isMol = await this.usersService.hasAccessToSklad(
          userId,
          obj.zavod,
          obj.sklad,
        );

        // Новые объекты может создавать только МОЛ
        if (!isMol && obj.id < 0) {
          console.warn(
            `[OfflineSyncService] Пропущен новый объект tempId=${obj.id} — ` +
            `пользователь не МОЛ склада ${obj.zavod}/${obj.sklad}`,
          );
          continue;
        }

        if (isMol) {
          await this.applyObjectChange(manager, userId, obj);
        } else {
          await this.transformToProposedChanges(manager, userId, obj);
        }

        processed++;
      }

      // ========================================================================
      // 2. ОБРАБОТКА СТРОК ИНВЕНТАРИЗАЦИОННЫХ КНИГ
      // ========================================================================
      if (dto.inventoryBookItemChanges?.length) {
        for (const item of dto.inventoryBookItemChanges) {
          await this.applyInventoryBookItemChange(manager, userId, item);
          inventoryItemsProcessed++;
        }
      }

      // ========================================================================
      // 3. ОБРАБОТКА ЯВНЫХ PROPOSED_CHANGES
      // ========================================================================
      if (dto.proposedChangeActions?.length) {
        await this.applyProposedChangeActions(manager, userId, dto.proposedChangeActions);
      }
    });

    console.log(
      `[OfflineSyncService] Синхронизация завершена: ` +
      `${processed} объектов, ${inventoryItemsProcessed} строк книг обработано`,
    );
    return { processed, inventoryItemsProcessed };
  }

  // ============================================================================
  // ПРИВАТНЫЕ МЕТОДЫ: ОБЪЕКТЫ
  // ============================================================================

  /**
   * Применяет изменение объекта для МОЛа.
   * Создаёт новый объект (id < 0) или обновляет существующий (id > 0).
   * Сохраняет связанные QR-коды, фото и логи.
   * 
   * @param manager — менеджер транзакции
   * @param userId — ID пользователя
   * @param obj — данные объекта из пакета синхронизации
   */
  private async applyObjectChange(
    manager: EntityManager,
    userId: number,
    obj: any,
  ): Promise<void> {
    let realId: number;

    if (obj.id < 0) {
      const createDto: CreateObjectDto = {
        zavod: obj.zavod,
        sklad: obj.sklad,
        buhName: obj.buhName,
        invNumber: obj.invNumber,
        partyNumber: obj.partyNumber ?? null,
        sn: obj.sn ?? null,
        placeTer: obj.placeTer ?? null,
        placePos: obj.placePos ?? null,
        placeCab: obj.placeCab ?? null,
        placeUser: obj.placeUser ?? null,
        qrCodes: obj.qrCodes,
        photosToAdd: obj.photosToAdd,
      };
      const created = await this.objectsService.create(createDto, userId, manager);
      realId = created.id;
      console.log(`[OfflineSyncService] МОЛ: создан объект tempId=${obj.id} → realId=${realId}`);
    } else {
      const updateDto: UpdateObjectDto = {
        zavod: obj.zavod ?? undefined,
        sklad: obj.sklad ?? undefined,
        partyNumber: obj.partyNumber ?? undefined,
        sn: obj.sn ?? undefined,
        placeTer: obj.placeTer ?? undefined,
        placePos: obj.placePos ?? undefined,
        placeCab: obj.placeCab ?? undefined,
        placeUser: obj.placeUser ?? undefined,
        checkedAt: obj.checkedAt,
        qrCodes: obj.qrCodes,
        photosToAdd: obj.photosToAdd,
        photosToUpdate: obj.photosToUpdate,
      };
      await this.objectsService.update(obj.id, updateDto, userId, manager);
      realId = obj.id;
      console.log(`[OfflineSyncService] МОЛ: обновлён объект id=${realId}`);
    }

    await this.saveObjectLogs(userId, realId, obj.logs);
  }

  /**
   * Трансформирует изменения неМОЛа в предлагаемые (proposed_changes).
   * Анализирует логи объекта и создаёт по одной записи proposed_changes
   * на каждый тип изменения (место, SN, фото, комментарий).
   * Фото создаются с object_id = 0.
   * QR-коды не передаются — неМОЛ не может предлагать QR-коды.
   * 
   * @param manager — менеджер транзакции
   * @param userId — ID пользователя
   * @param obj — данные объекта из пакета синхронизации
   */
  private async transformToProposedChanges(
    manager: EntityManager,
    userId: number,
    obj: any,
  ): Promise<void> {
    console.log(
      `[OfflineSyncService] неМОЛ: трансформируем изменения объекта ${obj.id} в proposed_changes`,
    );

    let userAbr = '???';
    try {
      const user = await this.usersService.findById(userId);
      userAbr = user.abr;
    } catch {
      console.warn(`[OfflineSyncService] Пользователь ${userId} не найден, используется userAbr='???'`);
    }

    const objectBuhName = obj.buhName || '';
    const objectInvNumber = obj.invNumber || '';
    const objectSn = obj.sn || null;
    const addedTypes = new Set<string>();

    if (obj.logs?.length) {
      for (const log of obj.logs) {
        switch (log.source) {
          case 'object-history':
            await this.handleObjectHistoryLog(
              manager, userId, userAbr, obj, log, objectBuhName,
              objectInvNumber, objectSn, addedTypes,
            );
            break;

          case 'photo-history':
            await this.handlePhotoHistoryLog(
              manager, userId, userAbr, obj, log, objectBuhName,
              objectInvNumber, objectSn,
            );
            break;

          default:
            console.log(`[OfflineSyncService] Пропущен лог с source=${log.source}`);
        }
      }
    }

    await this.saveObjectLogs(userId, obj.id, obj.logs);

    console.log(
      `[OfflineSyncService] неМОЛ: создано предложений для объекта ${obj.id}: ` +
      `${addedTypes.size} шт. (${[...addedTypes].join(', ')})`,
    );
  }

  /**
   * Обрабатывает лог типа object-history.
   * Определяет, изменилось ли место, серийный номер или добавлен комментарий,
   * и создаёт соответствующие proposed_changes.
   */
  private async handleObjectHistoryLog(
    manager: EntityManager,
    userId: number,
    userAbr: string,
    obj: any,
    log: any,
    objectBuhName: string,
    objectInvNumber: string,
    objectSn: string | null,
    addedTypes: Set<string>,
  ): Promise<void> {
    const content = log.content || {};
    const eventType = content.eventType;

    if (eventType === 'place_changed' && !addedTypes.has('place')) {
      const entity = manager.create(ProposedChange, {
        objectId: obj.id,
        changeType: 'place',
        proposedData: {
          placeTer: obj.placeTer ?? null,
          placePos: obj.placePos ?? null,
          placeCab: obj.placeCab ?? null,
          placeUser: obj.placeUser ?? null,
        },
        userId,
        userAbr,
        objectBuhName,
        objectInvNumber,
        objectSn,
        photoId: null,
      });
      await manager.save(entity);
      addedTypes.add('place');
      console.log(`[OfflineSyncService] неМОЛ: created proposed_change type=place`);
    }

    if (eventType === 'sn_changed' && !addedTypes.has('sn')) {
      const entity = manager.create(ProposedChange, {
        objectId: obj.id,
        changeType: 'sn',
        proposedData: { sn: obj.sn ?? null },
        userId,
        userAbr,
        objectBuhName,
        objectInvNumber,
        objectSn,
        photoId: null,
      });
      await manager.save(entity);
      addedTypes.add('sn');
      console.log(`[OfflineSyncService] неМОЛ: created proposed_change type=sn`);
    }

    if (eventType === 'comment' && !addedTypes.has('comment')) {
      const entity = manager.create(ProposedChange, {
        objectId: obj.id,
        changeType: 'comment',
        proposedData: { comment: content.storyLine || '' },
        userId,
        userAbr,
        objectBuhName,
        objectInvNumber,
        objectSn,
        photoId: null,
      });
      await manager.save(entity);
      addedTypes.add('comment');
      console.log(`[OfflineSyncService] неМОЛ: created proposed_change type=comment`);
    }
  }

  /**
   * Обрабатывает лог типа photo-history.
   * Создаёт фото с object_id = 0 из base64-данных, переданных в photosToAdd,
   * и формирует proposed_change с полученным photoId.
   */
  private async handlePhotoHistoryLog(
    manager: EntityManager,
    userId: number,
    userAbr: string,
    obj: any,
    log: any,
    objectBuhName: string,
    objectInvNumber: string,
    objectSn: string | null,
  ): Promise<void> {
    if (!obj.photosToAdd?.length) {
      console.warn(
        `[OfflineSyncService] неМОЛ: photo-history лог без photosToAdd, пропущен`,
      );
      return;
    }

    for (const photoDto of obj.photosToAdd) {
      const maxBuffer = Buffer.from(photoDto.max, 'base64');
      const minBuffer = Buffer.from(photoDto.min, 'base64');

      const photo = await this.photosService.createFromBuffers(
        0,
        maxBuffer,
        minBuffer,
        userId,
        manager,
      );

      const entity = manager.create(ProposedChange, {
        objectId: obj.id,
        changeType: 'photo',
        proposedData: null,
        userId,
        userAbr,
        objectBuhName,
        objectInvNumber,
        objectSn,
        photoId: photo.id,
      });
      await manager.save(entity);

      console.log(
        `[OfflineSyncService] неМОЛ: created proposed_change type=photo photoId=${photo.id}`,
      );
    }
  }

  /**
   * Сохраняет логи объекта с корректировкой objectId.
   * Если объект был создан (id < 0), заменяет временный ID на реальный.
   */
  private async saveObjectLogs(
    userId: number,
    realId: number,
    logs?: Array<{ source: string; time: string; content: any }>,
  ): Promise<void> {
    if (!logs?.length) return;

    for (const log of logs) {
      if (log.content) {
        if (log.content.objectId !== undefined) {
          log.content.objectId = realId;
        }
        if (log.content.object_id !== undefined) {
          log.content.object_id = realId;
        }
      }
      this.logsService.log(log.source, userId, log.content, new Date(log.time));
    }
    console.log(`[OfflineSyncService] Сохранено ${logs.length} логов для объекта ${realId}`);
  }

  // ============================================================================
  // ПРИВАТНЫЕ МЕТОДЫ: ИНВЕНТАРИЗАЦИОННЫЕ КНИГИ
  // ============================================================================

  /**
   * Применяет изменение строки инвентаризационной книги.
   * Сверяет даты ручного и автоматического подтверждений,
   * побеждает более свежее.
   */
  private async applyInventoryBookItemChange(
    manager: EntityManager,
    userId: number,
    item: any,
  ): Promise<void> {
    const dbItem = await manager.findOne(InventoryBookItem, {
      where: { idInventoryStatement: item.idInventoryStatement },
    });

    if (!dbItem) {
      console.warn(
        `[OfflineSyncService] Строка с idInventoryStatement=${item.idInventoryStatement} не найдена в БД, пропускаем`,
      );
      return;
    }

    const book = await manager.findOne(InventoryBook, {
      where: { id: dbItem.idBook },
    });

    if (!book) {
      console.warn(
        `[OfflineSyncService] Книга idBook=${dbItem.idBook} не найдена, строка ${item.idInventoryStatement} пропущена`,
      );
      return;
    }

    const dbDateManual = dbItem.dateOkManualChecked
      ? new Date(dbItem.dateOkManualChecked).getTime()
      : 0;
    const dbDateAuto = dbItem.dateOkAutoChecked
      ? new Date(dbItem.dateOkAutoChecked).getTime()
      : 0;
    const offlineDateManual = item.dateOkManualChecked
      ? new Date(item.dateOkManualChecked).getTime()
      : 0;
    const offlineDateAuto = item.dateOkAutoChecked
      ? new Date(item.dateOkAutoChecked).getTime()
      : 0;

    const isManualCancel = item.isOkManual === false && dbItem.isOkManual === true;
    const manualFresh = !isManualCancel && offlineDateManual > dbDateManual;
    const autoFresh = offlineDateAuto > dbDateAuto;
    const shouldUpdateObjectData = isManualCancel || manualFresh || autoFresh;

    console.log(
      `[OfflineSyncService] Строка ${item.idInventoryStatement}: ` +
      `manualCancel=${isManualCancel}, manualFresh=${manualFresh}, autoFresh=${autoFresh}, updateObject=${shouldUpdateObjectData}`,
    );

    if (isManualCancel) {
      dbItem.isOkManual = false;
      dbItem.idUserOkManualChecked = null;
      dbItem.dateOkManualChecked = null;
      console.log(
        `[OfflineSyncService] Ручное подтверждение отменено для строки ${item.idInventoryStatement}`,
      );
    } else if (manualFresh && item.isOkManual !== undefined) {
      dbItem.isOkManual = item.isOkManual;
      dbItem.dateOkManualChecked = item.dateOkManualChecked
        ? new Date(item.dateOkManualChecked)
        : null;
      console.log(
        `[OfflineSyncService] Обновлено ручное подтверждение для строки ${item.idInventoryStatement}`,
      );
    }

    if (autoFresh && item.isOkAuto !== undefined) {
      dbItem.isOkAuto = item.isOkAuto;
      dbItem.dateOkAutoChecked = item.dateOkAutoChecked
        ? new Date(item.dateOkAutoChecked)
        : null;
      console.log(
        `[OfflineSyncService] Обновлено авто подтверждение для строки ${item.idInventoryStatement}`,
      );
    }

    if (shouldUpdateObjectData) {
      if (item.idObject !== undefined) dbItem.idObject = item.idObject;
      if (item.placeTer !== undefined) dbItem.placeTer = item.placeTer;
      if (item.placePos !== undefined) dbItem.placePos = item.placePos;
      if (item.placeCab !== undefined) dbItem.placeCab = item.placeCab;
      if (item.placeUser !== undefined) dbItem.placeUser = item.placeUser;
      console.log(
        `[OfflineSyncService] Обновлены данные объекта для строки ${item.idInventoryStatement}`,
      );
    }

    if (item.rem !== undefined && item.rem !== null) {
      const dbRem = dbItem.rem || '';
      const offlineRem = item.rem || '';

      if (offlineRem && offlineRem !== dbRem) {
        dbItem.rem = dbRem ? `${dbRem}\n${offlineRem}` : offlineRem;
        console.log(
          `[OfflineSyncService] Комментарий дописан для строки ${item.idInventoryStatement}`,
        );
      } else if (!offlineRem && dbRem) {
        // Офлайн-rem пустой, а БД-rem есть — оставляем БД-rem без изменений
      } else if (offlineRem && !dbRem) {
        dbItem.rem = offlineRem;
      }
    }

    await manager.save(dbItem);

    if (item.logs?.length) {
      for (const log of item.logs) {
        this.logsService.log(log.source, userId, log.content, new Date(log.time));
      }
      console.log(
        `[OfflineSyncService] Сохранено ${item.logs.length} логов для строки ${item.idInventoryStatement}`,
      );
    }
  }

  // ============================================================================
  // ПРИВАТНЫЕ МЕТОДЫ: PROPOSED_CHANGES
  // ============================================================================

  /**
   * Применяет явные действия с proposed_changes, присланные фронтом.
   * 
   * ## Типы действий
   * - `create` — создание предложения от неМОЛа (создано в офлайне)
   * - `delete` — удаление предложения после решения МОЛа.
   *   Логика удаления фото делегирована в ProposedChangesService.remove.
   */
  private async applyProposedChangeActions(
    manager: EntityManager,
    userId: number,
    actions: Array<{
      action: string;
      id?: number;
      objectId?: number;
      changeType?: string;
      proposedData?: Record<string, any> | null;
      userId?: number;
      userAbr?: string;
      objectBuhName?: string;
      objectInvNumber?: string;
      objectSn?: string | null;
      photoId?: number | null;
    }>,
  ): Promise<void> {
    let createdCount = 0;
    let deletedCount = 0;

    for (const action of actions) {
      if (action.action === 'create') {
        const entity = manager.create(ProposedChange, {
          objectId: action.objectId,
          changeType: action.changeType,
          proposedData: action.proposedData || null,
          userId: action.userId || userId,
          userAbr: action.userAbr,
          objectBuhName: action.objectBuhName,
          objectInvNumber: action.objectInvNumber,
          objectSn: action.objectSn || null,
          photoId: action.photoId || null,
        });
        await manager.save(entity);
        createdCount++;
      } else if (action.action === 'delete') {
        if (action.id == null) {
          console.warn(`[OfflineSyncService] proposed_change delete без id, пропущен`);
          continue;
        }
        try {
          await this.proposedChangesService.remove(action.id, manager);
          deletedCount++;
        } catch (error) {
          if (error instanceof NotFoundException) {
            console.log(
              `[OfflineSyncService] proposed_change ${action.id} уже удалён другим МОЛом, пропускаем`,
            );
          } else {
            throw error;
          }
        }
      }
    }

    console.log(
      `[OfflineSyncService] proposed_changes: создано ${createdCount}, удалено ${deletedCount}`,
    );
  }
}