import { Injectable } from '@nestjs/common';
import { EntityManager, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectsService } from '../../objects/services/objects.service';
import { LogsService } from '../../logs/logs.service';
import { SyncChangesRequestDto } from '../dto/sync-changes.request.dto';
import { CreateObjectDto } from '../../objects/dto/create-object.dto';
import { UpdateObjectDto } from '../../objects/dto/update-object.dto';
import { InventoryBookItem } from '../../inventory/entities/inventory-book-item.entity';
import { InventoryBook } from '../../inventory/entities/inventory-book.entity';
import { ProposedChange } from '../../proposed-changes/entities/proposed-change.entity';
import { ProposedChangesService } from '../../proposed-changes/proposed-changes.service';
import { Photo } from '../../photos/entities/photos.entity';

/**
 * Сервис синхронизации изменений из офлайн-режима.
 * Применяет изменения, сделанные пользователем в офлайн-режиме,
 * к онлайн-базе данных: создание/обновление объектов,
 * обновление строк инвентаризационных книг.
 */
@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly objectsService: ObjectsService,
    private readonly logsService: LogsService,
    @InjectRepository(InventoryBookItem)
    private readonly inventoryBookItemRepository: Repository<InventoryBookItem>,
    @InjectRepository(InventoryBook)
    private readonly inventoryBookRepository: Repository<InventoryBook>,
    @InjectRepository(ProposedChange)
    private readonly proposedChangesRepository: Repository<ProposedChange>,
    private readonly proposedChangesService: ProposedChangesService,
    @InjectRepository(Photo)
    private readonly photosRepository: Repository<Photo>,    
  ) {}

  /**
   * Применяет изменения из офлайн-режима в одной большой транзакции.
   * Для каждого объекта: создаёт (id < 0) или обновляет (id > 0),
   * затем сохраняет связанные QR-коды, фото и логи.
   * Для строк инвентаризационных книг: сверяет даты подтверждений и обновляет.
   * 
   * @param userId - ID пользователя
   * @param dto - DTO с изменениями
   * @returns количество обработанных объектов и строк книг
   */
  async applyChanges(userId: number, dto: SyncChangesRequestDto): Promise<{ processed: number; inventoryItemsProcessed: number }> {
    console.log(`[OfflineSyncService] Применяем ${dto.changes.length} изменений объектов и ${dto.inventoryBookItemChanges?.length || 0} строк книг для userId=${userId}`);

    let processed = 0;
    let inventoryItemsProcessed = 0;

    await this.entityManager.transaction(async (manager) => {
      // ========================================================================
      // ОБРАБОТКА ОБЪЕКТОВ
      // ========================================================================
      for (const obj of dto.changes) {
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
          console.log(`[OfflineSyncService] Создан объект: tempId=${obj.id} → realId=${realId}`);
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
          console.log(`[OfflineSyncService] Обновлён объект: id=${realId}`);
        }

        // Сохраняем логи объекта
        if (obj.logs?.length) {
          for (const log of obj.logs) {
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
          console.log(`[OfflineSyncService] Сохранено ${obj.logs.length} логов для объекта ${realId}`);
        }

        processed++;
      }

      // ========================================================================
      // ОБРАБОТКА СТРОК ИНВЕНТАРИЗАЦИОННЫХ КНИГ
      // ========================================================================
      if (dto.inventoryBookItemChanges?.length) {
        for (const item of dto.inventoryBookItemChanges) {
          // 1. Найти запись в БД по idInventoryStatement
          const dbItem = await manager.findOne(InventoryBookItem, {
            where: { idInventoryStatement: item.idInventoryStatement },
          });

          if (!dbItem) {
            console.warn(`[OfflineSyncService] Строка с idInventoryStatement=${item.idInventoryStatement} не найдена в БД, пропускаем`);
            continue;
          }

          // 2. Проверить, существует ли книга
          const book = await manager.findOne(InventoryBook, {
            where: { id: dbItem.idBook },
          });

          if (!book) {
            console.warn(`[OfflineSyncService] Книга idBook=${dbItem.idBook} не найдена, строка ${item.idInventoryStatement} пропущена`);
            continue;
          }

          // 3. Определяем победителя по свежести
          const dbDateManual = dbItem.dateOkManualChecked ? new Date(dbItem.dateOkManualChecked).getTime() : 0;
          const dbDateAuto = dbItem.dateOkAutoChecked ? new Date(dbItem.dateOkAutoChecked).getTime() : 0;
          const offlineDateManual = item.dateOkManualChecked ? new Date(item.dateOkManualChecked).getTime() : 0;
          const offlineDateAuto = item.dateOkAutoChecked ? new Date(item.dateOkAutoChecked).getTime() : 0;

          // Отмена ручного подтверждения (только владелец) — безусловно
          const isManualCancel = item.isOkManual === false && dbItem.isOkManual === true;

          // Онлайн-подтверждение свежее офлайн
          const manualFresh = !isManualCancel && offlineDateManual > dbDateManual;
          const autoFresh = offlineDateAuto > dbDateAuto;

          // Данные объекта обновляем, если хотя бы одно подтверждение свежее
          const shouldUpdateObjectData = isManualCancel || manualFresh || autoFresh;

          console.log(`[OfflineSyncService] Строка ${item.idInventoryStatement}: manualCancel=${isManualCancel}, manualFresh=${manualFresh}, autoFresh=${autoFresh}, updateObject=${shouldUpdateObjectData}`);

          // 4. Применяем isOkManual
          if (isManualCancel) {
            dbItem.isOkManual = false;
            dbItem.idUserOkManualChecked = null;
            dbItem.dateOkManualChecked = null;
            console.log(`[OfflineSyncService] Ручное подтверждение отменено для строки ${item.idInventoryStatement}`);
          } else if (manualFresh && item.isOkManual !== undefined) {
            dbItem.isOkManual = item.isOkManual;
            dbItem.dateOkManualChecked = item.dateOkManualChecked ? new Date(item.dateOkManualChecked) : null;
            console.log(`[OfflineSyncService] Обновлено ручное подтверждение для строки ${item.idInventoryStatement}`);
          }

          // 5. Применяем isOkAuto
          if (autoFresh && item.isOkAuto !== undefined) {
            dbItem.isOkAuto = item.isOkAuto;
            dbItem.dateOkAutoChecked = item.dateOkAutoChecked ? new Date(item.dateOkAutoChecked) : null;
            console.log(`[OfflineSyncService] Обновлено авто подтверждение для строки ${item.idInventoryStatement}`);
          }

          // 6. Обновляем данные объекта
          if (shouldUpdateObjectData) {
            if (item.idObject !== undefined) dbItem.idObject = item.idObject;
            if (item.placeTer !== undefined) dbItem.placeTer = item.placeTer;
            if (item.placePos !== undefined) dbItem.placePos = item.placePos;
            if (item.placeCab !== undefined) dbItem.placeCab = item.placeCab;
            if (item.placeUser !== undefined) dbItem.placeUser = item.placeUser;
            console.log(`[OfflineSyncService] Обновлены данные объекта для строки ${item.idInventoryStatement}`);
          }

          // 7. Обработка rem — дописываем, если отличается
          if (item.rem !== undefined && item.rem !== null) {
            const dbRem = dbItem.rem || '';
            const offlineRem = item.rem || '';

            if (offlineRem && offlineRem !== dbRem) {
              dbItem.rem = dbRem 
                ? `${dbRem}\n${offlineRem}` 
                : offlineRem;
              console.log(`[OfflineSyncService] Комментарий дописан для строки ${item.idInventoryStatement}`);
            } else if (!offlineRem && dbRem) {
              // Офлайн-rem пустой, а БД-rem есть — оставляем БД-rem без изменений
            } else if (offlineRem && !dbRem) {
              dbItem.rem = offlineRem;
            }
          }

          await manager.save(dbItem);

          // 8. Сохраняем логи
          if (item.logs?.length) {
            for (const log of item.logs) {
              this.logsService.log(log.source, userId, log.content, new Date(log.time));
            }
            console.log(`[OfflineSyncService] Сохранено ${item.logs.length} логов для строки ${item.idInventoryStatement}`);
          }

          inventoryItemsProcessed++;
        }
      }

      // ========================================================================
      // ОБРАБОТКА PROPOSED_CHANGES
      // ========================================================================
      if (dto.proposedChangeActions?.length) {
        let createdCount = 0;
        let deletedCount = 0;
        let skippedCount = 0;

        for (const action of dto.proposedChangeActions) {
          if (action.action === 'create') {
            // Предложение от неМОЛа, созданное в офлайне — просто сохраняем
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
            const existing = await manager.findOne(ProposedChange, {
              where: { id: action.id }
            });

            if (!existing) {
              console.log(`[OfflineSyncService] proposed_change ${action.id} уже удалён другим МОЛом, пропускаем`);
              skippedCount++;
              continue;
            }

            // Если есть фото — проверяем, утверждено оно или отклонено
            if (existing.photoId) {
              const photo = await manager.findOne(Photo, {
                where: { id: existing.photoId }
              });

              if (photo) {
                if (photo.objectId > 0) {
                  // Фото утверждено (привязано к объекту) — удаляем только запись, фото оставляем
                  await manager.remove(existing);
                  console.log(`[OfflineSyncService] proposed_change ${action.id} удалён, фото ${photo.id} оставлено (object_id=${photo.objectId})`);
                } else {
                  // Фото отклонено (object_id = 0) — удаляем и запись, и фото
                  await manager.remove(photo);
                  await manager.remove(existing);
                  console.log(`[OfflineSyncService] proposed_change ${action.id} и фото ${photo.id} удалены`);
                }
              } else {
                // Фото уже удалено (невозможный случай) — просто удаляем запись
                await manager.remove(existing);
                console.log(`[OfflineSyncService] proposed_change ${action.id} удалён, фото ${existing.photoId} не найден`);
              }
            } else {
              // Это предлагаемое событие не про фото. Просто удаляем запись
              await manager.remove(existing);
              console.log(`[OfflineSyncService] proposed_change ${action.id} удалён`);
            }

            deletedCount++;
          }
        }

        console.log(`[OfflineSyncService] proposed_changes: создано ${createdCount}, удалено ${deletedCount}, пропущено ${skippedCount}`);
      }
    });

    console.log(`[OfflineSyncService] Синхронизация завершена: ${processed} объектов, ${inventoryItemsProcessed} строк книг обработано`);
    return { processed, inventoryItemsProcessed };
  }
}