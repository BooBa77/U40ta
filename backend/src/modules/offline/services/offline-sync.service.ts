import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectsService } from '../../objects/services/objects.service';
import { LogsService } from '../../logs/logs.service';
import { SyncChangesRequestDto } from '../dto/sync-changes.request.dto';
import { CreateObjectDto } from '../../objects/dto/create-object.dto';
import { UpdateObjectDto } from '../../objects/dto/update-object.dto';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { InventoryBookItem } from '../../inventory/entities/inventory-book-item.entity';
import { InventoryBook } from '../../inventory/entities/inventory-book.entity';
import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly objectsService: ObjectsService,
    private readonly logsService: LogsService,
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    @InjectRepository(InventoryBookItem)
    private readonly inventoryBookItemRepository: Repository<InventoryBookItem>,
    @InjectRepository(InventoryBook)
    private readonly inventoryBookRepository: Repository<InventoryBook>,
    private readonly appEventsService: AppEventsService,    
  ) {}

  /**
   * Применяет изменения из офлайн-режима в одной большой транзакции.
   * Для каждого объекта: создаёт (id < 0) или обновляет (id > 0),
   * затем сохраняет связанные QR-коды, фото и логи.
   * Для строк инвентаризационных книг: сверяет даты подтверждений и обновляет.
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
            sn: obj.sn ?? undefined,
            placeTer: obj.placeTer ?? undefined,
            placePos: obj.placePos ?? undefined,
            placeCab: obj.placeCab ?? undefined,
            placeUser: obj.placeUser ?? undefined,
            checkedAt: obj.checkedAt,
            qrCodes: obj.qrCodes,
            photosToAdd: obj.photosToAdd,
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
              // Дописываем офлайн-rem к БД-rem, если они различаются
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
    });

    // SSE для ведомостей (существующая логика)
    if (processed > 0) {
      const uniquePairs = new Map<string, { zavod: number; sklad: string }>();
      for (const obj of dto.changes) {
        const key = `${obj.zavod}_${obj.sklad}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { zavod: obj.zavod, sklad: obj.sklad });
        }
      }
      const pairs = Array.from(uniquePairs.values());
      for (const pair of pairs) {
        const attachments = await this.emailAttachmentRepository.find({
          where: { zavod: pair.zavod, sklad: pair.sklad },
          select: ['id'],
        });
        for (const att of attachments) {
          this.appEventsService.notifyStatementUpdated(att.id);
          console.log(`[OfflineSyncService] SSE отправлено для attachmentId=${att.id}`);
        }
      }
    }

    console.log(`[OfflineSyncService] Синхронизация завершена: ${processed} объектов, ${inventoryItemsProcessed} строк книг обработано`);
    return { processed, inventoryItemsProcessed };
  }
}