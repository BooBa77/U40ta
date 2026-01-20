// offline/services/offline.service.ts
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
  async getOfflineData(userId): Promise<any> {
    console.log(`OfflineService: получение ВСЕХ данных для офлайн-режима`);
    
    try {
      const data = await this.offlineCacheService.getAllData(userId);
      
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

  // ===== НОВЫЕ МЕТОДЫ ДЛЯ ПЕРЕКЛЮЧЕНИЯ РЕЖИМОВ =====

  /**
   * Проверяет, нужна ли синхронизация при переключении из офлайн в онлайн
   * @param localChanges Локальная история изменений из IndexedDB
   * @returns Информация о необходимости синхронизации
   */
  checkIfSyncNeeded(localChanges: any[]): { needsSync: boolean; message: string } {
    console.log(`OfflineService: проверка необходимости синхронизации для ${localChanges?.length || 0} локальных изменений`);
    
    // Если истории нет или она пустая - синхронизация не нужна
    if (!localChanges || localChanges.length === 0) {
      return {
        needsSync: false,
        message: 'Локальная история пуста. Можно переключаться на онлайн без синхронизации.'
      };
    }
    
    // Если есть изменения - нужна синхронизация
    return {
      needsSync: true,
      message: `Обнаружено ${localChanges.length} локальных изменений. Требуется синхронизация перед переходом в онлайн.`
    };
  }

  /**
   * Подтверждение очистки локального кэша
   * Вызывается после успешной синхронизации или если синхронизация не требуется
   * @returns Подтверждение для клиента
   */
  confirmCacheClear(): { success: boolean; message: string } {
    console.log('OfflineService: подтверждение очистки кэша');
    
    // Этот метод просто подтверждает, что сервер разрешает очистку
    // Реальная очистка IndexedDB происходит на клиенте
    return {
      success: true,
      message: 'Сервер подтверждает очистку локального кэша. Клиент может очистить IndexedDB.'
    };
  }
}