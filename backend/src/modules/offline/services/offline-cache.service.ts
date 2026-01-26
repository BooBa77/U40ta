import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';
import { ObjectChange } from '../../object_changes/entities/object-change.entity';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';
import { MolAccess } from '../../statements/entities/mol-access.entity';

@Injectable()
export class OfflineCacheService {
  constructor(
    @InjectRepository(InventoryObject)
    private objectsRepository: Repository<InventoryObject>,
    
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
   */
  async getAllData(userId: number): Promise<any> {
    console.log(`OfflineCacheService: получение данных для пользователя ${userId}`);
    
    try {
      // 1. Получаем доступные склады пользователя
      const userAccess = await this.molAccessRepository.find({
        where: { userId },
        select: ['zavod', 'sklad'],
      });
      
      console.log(`OfflineCacheService: пользователь имеет доступ к ${userAccess.length} складам`);
      
      // 2. Получаем ВСЕ объекты
      const objects = await this.objectsRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ объектов: ${objects.length}`);
      
      // 3. Получаем ВСЮ историю изменений
      const objectChanges = await this.objectChangesRepository.find({
        order: { changed_at: 'DESC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕЙ истории: ${objectChanges.length}`);
      
      // 4. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ QR-кодов: ${qrCodes.length}`);
      
      // 5. Получаем ведомости для доступных складов
      let statements: ProcessedStatement[] = [];
      
      if (userAccess.length > 0) {
        const whereConditions = userAccess.map(access => ({
          zavod: access.zavod,
          sklad: access.sklad,
        }));
        
        statements = await this.statementsRepository.find({
          where: whereConditions,
          order: { id: 'ASC' },
        });
        
        console.log(`OfflineCacheService: найдено ВСЕХ доступных ведомостей: ${statements.length}`);
      } else {
        console.log('OfflineCacheService: у пользователя нет доступа к складам');
      }
      
      // 6. Формируем ответ с правильной сериализацией
      return {
        objects: this.serializeObjects(objects),
        processed_statements: statements,
        object_changes: objectChanges,
        qr_codes: qrCodes,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalObjects: objects.length,
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
   *Сериализация объектов
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
      commentary: obj.commentary,
      is_written_off: obj.is_written_off,
      checked_at: obj.checked_at,
      place_ter: obj.place_ter,
      place_pos: obj.place_pos,
      place_cab: obj.place_cab,
      place_user: obj.place_user,
    }));
  }
}