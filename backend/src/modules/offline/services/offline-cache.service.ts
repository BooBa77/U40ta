// app/src/modules/offline/services/offline-cache.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';
import { Place } from '../../places/entities/place.entity';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';
import { ObjectChange } from '../../object_changes/entities/object-change.entity';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';

@Injectable()
export class OfflineCacheService {
  constructor(
    @InjectRepository(InventoryObject)
    private objectsRepository: Repository<InventoryObject>,
    
    @InjectRepository(Place)
    private placesRepository: Repository<Place>,
    
    @InjectRepository(ProcessedStatement)
    private statementsRepository: Repository<ProcessedStatement>,
    
    @InjectRepository(ObjectChange)
    private objectChangesRepository: Repository<ObjectChange>,
    
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
  ) {}

  /**
   * Собирает ВСЕ данные для офлайн-режима
   * Включает все объекты, места, ведомости, историю изменений и QR-коды
   * @returns Объект со всеми данными для кэширования
   */
  async getAllData(): Promise<any> {
    console.log(`OfflineCacheService: получение ВСЕХ данных для офлайн-режима`);
    
    try {
      // 1. Получаем ВСЕ объекты
      const objects = await this.objectsRepository.find({
        relations: ['placeEntity'],
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено объектов: ${objects.length}`);
      
      // 2. Получаем ВСЕ места
      const places = await this.placesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено мест: ${places.length}`);
      
      // 3. Получаем ВСЕ ведомости (активные, без фильтрации по доступности)
      // Находим email_attachment_id ВСЕХ активных ведомостей
      const activeStatements = await this.statementsRepository
        .createQueryBuilder('ps')
        .select('DISTINCT ps.emailAttachmentId', 'attachmentId')
        .where('ps.emailAttachmentId IS NOT NULL')
        .getRawMany();
      
      const activeAttachmentIds = activeStatements.map(s => s.attachmentId);
      
      let statements: ProcessedStatement[] = [];
      if (activeAttachmentIds.length > 0) {
        statements = await this.statementsRepository.find({
          where: { 
            emailAttachmentId: activeAttachmentIds,
            is_excess: false, // Только основные записи, не избыточные
          },
          order: { id: 'ASC' },
        });
      }
      
      console.log(`OfflineCacheService: загружено ведомостей: ${statements.length}`);
      
      // 4. Получаем ВСЮ историю изменений (без ограничения по времени)
      const objectChanges = await this.objectChangesRepository.find({
        order: { changed_at: 'DESC' },
      });
      
      console.log(`OfflineCacheService: загружено записей истории: ${objectChanges.length}`);
      
      // 5. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено QR-кодов: ${qrCodes.length}`);
      
      // 6. Формируем ответ
      return {
        objects: this.serializeObjects(objects),
        places,
        processed_statements: statements,
        object_changes: objectChanges,
        qr_codes: qrCodes,
        meta: {
          fetchedAt: new Date().toISOString(),
          totalObjects: objects.length,
          totalStatements: statements.length,
          totalObjectChanges: objectChanges.length,
          totalQrCodes: qrCodes.length,
        }
      };
      
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении ВСЕХ данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }
  
  /**
   * Сериализует объекты для безопасной передачи (убирает циклические зависимости)
   * @param objects Массив объектов InventoryObject
   * @returns Сериализованные объекты
   */
  private serializeObjects(objects: InventoryObject[]): any[] {
    return objects.map(obj => ({
      id: obj.id,
      zavod: obj.zavod,
      sklad: obj.sklad,
      buh_name: obj.buh_name,
      inv_number: obj.inv_number,
      party_number: obj.party_number,
      sn: obj.sn,
      place: obj.placeEntity ? {
        id: obj.placeEntity.id,
        ter: obj.placeEntity.ter,
        pos: obj.placeEntity.pos,
        cab: obj.placeEntity.cab,
        user: obj.placeEntity.user,
      } : null,
      commentary: obj.commentary,
    }));
  }
}