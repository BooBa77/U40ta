// app/src/modules/offline/services/offline-cache.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';
import { Place } from '../../places/entities/place.entity';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';
import { ObjectChange } from '../../object_changes/entities/object-change.entity';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';
import { MolAccess } from '../../statements/entities/mol-access.entity';

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
    
    @InjectRepository(MolAccess)
    private molAccessRepository: Repository<MolAccess>,
  ) {}

  /**
   * Собирает данные для офлайн-режима для конкретного пользователя
   * ВСЕ объекты, места, история, QR-коды + ведомости по mol_access
   * @param userId ID пользователя для фильтрации ведомостей
   * @returns Объект со всеми данными для кэширования
   */
  async getAllData(userId: number): Promise<any> {
    console.log(`OfflineCacheService: получение данных для пользователя ${userId}`);
    
    try {
      // 1. Получаем доступные склады пользователя из mol_access
      const userAccess = await this.molAccessRepository.find({
        where: { userId },
        select: ['zavod', 'sklad'],
      });
      
      console.log(`OfflineCacheService: пользователь имеет доступ к ${userAccess.length} складам`);
      
      // 2. Получаем ВСЕ объекты (без фильтрации)
      const objects = await this.objectsRepository.find({
        relations: ['placeEntity'],
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ объектов: ${objects.length}`);
      
      // 3. Получаем ВСЕ места
      const places = await this.placesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ мест: ${places.length}`);
      
      // 4. Получаем ВСЮ историю изменений (без ограничения по времени)
      const objectChanges = await this.objectChangesRepository.find({
        order: { changed_at: 'DESC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕЙ истории: ${objectChanges.length}`);
      
      // 5. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ QR-кодов: ${qrCodes.length}`);
      
      // 6. Получаем ведомости ТОЛЬКО по доступным складам (mol_access)
      let statements: ProcessedStatement[] = [];
      
      if (userAccess.length > 0) {
        // Собираем уникальные пары zavod/sklad
        const uniqueAccess = Array.from(
          new Set(userAccess.map(access => `${access.zavod}|${access.sklad}`))
        ).map(key => {
          const [zavod, sklad] = key.split('|');
          return { zavod: parseInt(zavod), sklad };
        });
        
        // Получаем ведомости для каждого доступного склада
        const statementPromises = uniqueAccess.map(({ zavod, sklad }) => 
          this.statementsRepository.find({
            where: { 
              zavod,
              sklad,
              is_excess: false, // Только основные записи
            },
            order: { id: 'ASC' },
          })
        );
        
        const results = await Promise.all(statementPromises);
        statements = results.flat();
      }
      
      console.log(`OfflineCacheService: загружено ведомостей (по mol_access): ${statements.length}`);
      
      // 7. Формируем ответ
      return {
        objects: this.serializeObjects(objects),
        places,
        processed_statements: statements,
        object_changes: objectChanges,
        qr_codes: qrCodes,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalObjects: objects.length,
          totalPlaces: places.length,
          totalStatements: statements.length,
          totalObjectChanges: objectChanges.length,
          totalQrCodes: qrCodes.length,
          accessibleSklads: userAccess.length,
        }
      };
      
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }
  
  /**
   * Сериализует объекты для безопасной передачи
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