import { Injectable } from '@nestjs/common';
import { LogsService } from 'src/modules/logs';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineSyncService } from './offline-sync.service';

@Injectable()
export class OfflineService {
  constructor(
    private readonly logsService: LogsService,
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
      const emailAttachmentsCount = data?.email_attachments?.length || 0;
      const statementsCount = data?.processed_statements?.length || 0;
      const objectsCount = data?.objects?.length || 0;
      const qrCodesCount = data?.qr_codes?.length || 0;
      
      this.logsService.log('offline_mode', userId, {
        action: 'offline_mode_entered',
        userId: userId,
        totalEmailAttachments: data?.meta?.totalEmailAttachments || 0,
        totalStatements: data?.meta?.totalStatements || 0,
        totalObjects: data?.meta?.totalObjects || 0,
        totalQrCodes: data?.meta?.totalQrCodes || 0,
      });      
      
      console.log(`OfflineService: данные получены`);
      console.log(`  - Файлов ведомостей: ${emailAttachmentsCount}`);
      console.log(`  - Объектов в ведомостях : ${statementsCount}`);
      console.log(`  - Объектов: ${objectsCount}`);
      console.log(`  - QR-кодов: ${qrCodesCount}`);
      
      return {
        email_attachments: data?.email_attachments || [],
        processed_statements: data?.processed_statements || [],
        objects: data?.objects || [],
        qr_codes: data?.qr_codes || [],
        meta: data?.meta || { userId }
      };
      
    } catch (error) {

      this.logsService.log('offline_mode', userId || null, {
        action: 'offline_mode_error',
        userId: userId || null,
        error: error.message,
      });      
      
      console.error('OfflineService: ошибка:', error);
      
      // Возвращаем пустую структуру данных при ошибке
      return {
        email_attachments: [],
        processed_statements: [],
        objects: [],
        qr_codes: [],
        meta: { 
          userId, 
          fetchedAt: new Date().toISOString(),
          totalEmailAttachments: 0,
          totalStatements: 0,
          totalObjects: 0,
          totalQrCodes: 0,
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