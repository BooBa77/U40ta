import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectsService } from '../../objects/services/objects.service';
import { LogsService } from '../../logs/logs.service';
import { SyncChangesRequestDto } from '../dto/sync-changes.request.dto';
import { CreateObjectDto } from '../../objects/dto/create-object.dto';
import { UpdateObjectDto } from '../../objects/dto/update-object.dto';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly objectsService: ObjectsService,
    private readonly logsService: LogsService,
    @InjectRepository(EmailAttachment)
    private readonly emailAttachmentRepository: Repository<EmailAttachment>,
    private readonly appEventsService: AppEventsService,    
  ) {}

  /**
   * Применяет изменения из офлайн-режима в одной большой транзакции.
   * Для каждого объекта: создаёт (id < 0) или обновляет (id > 0),
   * затем сохраняет связанные QR-коды, фото и логи.
   */
  async applyChanges(userId: number, dto: SyncChangesRequestDto): Promise<{ processed: number }> {
    console.log(`[OfflineSyncService] Применяем ${dto.changes.length} изменений для userId=${userId}`);

    let processed = 0;

    await this.entityManager.transaction(async (manager) => {
      for (const obj of dto.changes) {
        let realId: number;

        if (obj.id < 0) {
          // Создание нового объекта
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
          // Обновление существующего объекта
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

        // Сохраняем логи
        if (obj.logs?.length) {
          for (const log of obj.logs) {
            // Подменяем временный ID на реальный
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
    });

    // формируем SSE statement-updated для перезагрузки ведомости
    if (processed > 0) {
      // Собираем уникальные пары zavod + sklad
      const uniquePairs = new Map<string, { zavod: number; sklad: string }>();
      for (const obj of dto.changes) {
        const key = `${obj.zavod}_${obj.sklad}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { zavod: obj.zavod, sklad: obj.sklad });
        }
      }
      // Находим все email_attachments с такими zavod и sklad
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


    console.log(`[OfflineSyncService] Синхронизация завершена: ${processed} объектов обработано`);
    return { processed };
  }
}