// app/src/modules/offline/services/offline.service.ts
import { Injectable } from '@nestjs/common';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineSyncService } from './offline-sync.service';

@Injectable()
export class OfflineService {
  constructor(
    private readonly offlineCacheService: OfflineCacheService,
    private readonly offlineSyncService: OfflineSyncService,
  ) {}

  /**
   * Основной метод для получения ВСЕХ данных для кэширования
   * Не фильтрует по пользователю - отдает ВСЕ данные
   * @returns Данные для офлайн-режима
   */
  async getOfflineData(): Promise<any> {
    console.log(`OfflineService: получение ВСЕХ данных для офлайн-режима`);
    
    try {
      const data = await this.offlineCacheService.getAllData();
      
      console.log(`OfflineService: ВСЕ данные успешно получены`);
      console.log(`  - Объектов: ${data.objects.length}`);
      console.log(`  - Мест: ${data.places.length}`);
      console.log(`  - Ведомостей: ${data.processed_statements.length}`);
      console.log(`  - Истории изменений: ${data.object_changes.length}`);
      console.log(`  - QR-кодов: ${data.qr_codes.length}`);
      
      return data;
      
    } catch (error) {
      console.error('OfflineService: ошибка при получении ВСЕХ данных:', error);
      throw error;
    }
  }

  /**
   * Основной метод для синхронизации изменений
   * @param userId ID пользователя (для записи в историю изменений)
   * @param changes Массив изменений из офлайн-режима
   * @returns Результат синхронизации
   */
  async syncChanges(userId: number, changes: any[]): Promise<any> {
    console.log(`OfflineService: синхронизация ${changes.length} изменений от пользователя ${userId}`);
    
    try {
      const result = await this.offlineSyncService.applyChanges(userId, changes);
      
      console.log(`OfflineService: синхронизация завершена`);
      return result;
      
    } catch (error) {
      console.error('OfflineService: ошибка при синхронизации:', error);
      throw error;
    }
  }
}