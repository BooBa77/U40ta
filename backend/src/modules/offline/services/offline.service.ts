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
   * Работает даже с пустыми таблицами
   */
  async getOfflineData(userId): Promise<any> {
    console.log(`OfflineService: получение данных для офлайн-режима (userId: ${userId})`);
    
    try {
      const data = await this.offlineCacheService.getAllData(userId);
      
      // Безопасная проверка размеров
      const objectsCount = data?.objects?.length || 0;
      const statementsCount = data?.processed_statements?.length || 0;
      const changesCount = data?.object_changes?.length || 0;
      const qrCodesCount = data?.qr_codes?.length || 0;
      
      console.log(`OfflineService: данные получены`);
      console.log(`  - Объектов: ${objectsCount}`);
      console.log(`  - Ведомостей: ${statementsCount}`);
      console.log(`  - Истории: ${changesCount}`);
      console.log(`  - QR-кодов: ${qrCodesCount}`);
      
      return {
        objects: data?.objects || [],
        processed_statements: data?.processed_statements || [],
        object_changes: data?.object_changes || [],
        qr_codes: data?.qr_codes || [],
        meta: data?.meta || { userId }
      };
      
    } catch (error) {
      console.error('OfflineService: ошибка:', error);
      
      // Возвращаем пустую структуру данных при ошибке
      return {
        objects: [],
        processed_statements: [],
        object_changes: [],
        qr_codes: [],
        meta: { 
          userId, 
          fetchedAt: new Date().toISOString(),
          totalObjects: 0,
          totalStatements: 0,
          totalObjectChanges: 0,
          totalQrCodes: 0,
          accessibleSklads: 0,
        }
      };
    }
  }

  /**
   * Основной метод для синхронизации изменений
   */
  async syncChanges(userId: number, changes: any[]): Promise<any> {
    console.log(`OfflineService: синхронизация ${changes?.length || 0} изменений`);
    
    try {
      const result = await this.offlineSyncService.applyChanges(userId, changes || []);
      return {
        success: true,
        ...result,
        message: 'Синхронизация завершена'
      };
      
    } catch (error) {
      console.error('OfflineService: ошибка синхронизации:', error);
      return {
        success: false,
        message: `Ошибка синхронизации: ${error.message}`
      };
    }
  }

  /**
   * Проверяет, нужна ли синхронизация при переключении из офлайн в онлайн
   */
  checkIfSyncNeeded(localChanges: any[]): { success: boolean; needsSync: boolean; message: string } {
    const changesCount = localChanges?.length || 0;
    console.log(`OfflineService: проверка синхронизации (изменений: ${changesCount})`);
    
    if (changesCount === 0) {
      return {
        success: true,
        needsSync: false,
        message: 'Нет локальных изменений. Можно переключаться.'
      };
    }
    
    return {
      success: true,
      needsSync: true,
      message: `Обнаружено ${changesCount} локальных изменений. Требуется синхронизация.`
    };
  }

  /**
   * Подтверждение очистки локального кэша
   */
  confirmCacheClear(): { success: boolean; message: string } {
    console.log('OfflineService: подтверждение очистки кэша');
    return {
      success: true,
      message: 'Кэш может быть очищен'
    };
  }
}