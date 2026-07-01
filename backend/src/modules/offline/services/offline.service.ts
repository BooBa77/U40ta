import { Injectable } from '@nestjs/common';
import { LogsService } from 'src/modules/logs';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineSyncService } from './offline-sync.service';
import { SyncChangesRequestDto } from '../dto/sync-changes.request.dto';

/**
 * Сервис офлайн-режима.
 * 
 * ## Назначение
 * Координирует работу офлайн-режима: загрузку данных для кэширования,
 * синхронизацию изменений при выходе в онлайн, проверку необходимости синхронизации.
 * 
 * ## Архитектура
 * - `OfflineCacheService` — сбор данных из БД для кэша
 * - `OfflineSyncService` — применение офлайн-изменений к БД
 * - `LogsService` — логирование действий
 */
@Injectable()
export class OfflineService {
  constructor(
    private readonly logsService: LogsService,
    private readonly offlineCacheService: OfflineCacheService,
    private readonly offlineSyncService: OfflineSyncService,
  ) {}

  /**
   * Получает все данные для офлайн-режима.
   * Вызывает OfflineCacheService для сбора объектов, ведомостей, QR-кодов,
   * инвентаризационных книг, предлагаемых изменений и связанных фото.
   * Логирует факт входа в офлайн-режим.
   * 
   * @param userId — ID пользователя, запрашивающего данные
   * @returns объект с данными для кэширования на фронте:
   *   - statements — строки ведомостей МОЛ
   *   - objects — все объекты
   *   - qr_codes — все QR-коды
   *   - photos — фото из предлагаемых изменений
   *   - proposed_changes — предлагаемые изменения для складов МОЛа
   *   - inventory_books — инвентаризационные книги ревизора
   *   - inventory_book_items — строки инвентаризационных книг
   *   - meta — метаданные (userId, fetchedAt, количество по каждой сущности)
   */
  async getOfflineData(userId: number): Promise<any> {
    console.log(`OfflineService: получение данных для офлайн-режима (userId: ${userId})`);

    try {
      const data = await this.offlineCacheService.getAllData(userId);

      const statementsCount = data?.statements?.length || 0;
      const objectsCount = data?.objects?.length || 0;
      const qrCodesCount = data?.qr_codes?.length || 0;
      const photosCount = data?.photos?.length || 0;
      const proposedChangesCount = data?.proposed_changes?.length || 0;
      const inventoryBooksCount = data?.inventory_books?.length || 0;
      const inventoryBookItemsCount = data?.inventory_book_items?.length || 0;

      this.logsService.log('offline_mode', userId, {
        action: 'offline_mode_entered',
        userId,
        totalStatements: statementsCount,
        totalObjects: objectsCount,
        totalQrCodes: qrCodesCount,
        totalPhotos: photosCount,
        totalProposedChanges: proposedChangesCount,
        totalInventoryBooks: inventoryBooksCount,
        totalInventoryBookItems: inventoryBookItemsCount,
      });

      console.log(`OfflineService: данные получены`);
      console.log(`  - Строк ведомостей: ${statementsCount}`);
      console.log(`  - Объектов: ${objectsCount}`);
      console.log(`  - QR-кодов: ${qrCodesCount}`);
      console.log(`  - Фото (из proposed_changes): ${photosCount}`);
      console.log(`  - Предлагаемых изменений: ${proposedChangesCount}`);
      console.log(`  - Инвентаризационных книг: ${inventoryBooksCount}`);
      console.log(`  - Строк инвентаризационных книг: ${inventoryBookItemsCount}`);

      return {
        statements: data?.statements || [],
        objects: data?.objects || [],
        qr_codes: data?.qr_codes || [],
        photos: data?.photos || [],
        proposed_changes: data?.proposed_changes || [],
        inventory_books: data?.inventory_books || [],
        inventory_book_items: data?.inventory_book_items || [],
        meta: {
          userId,
          fetchedAt: data?.meta?.fetchedAt || new Date().toISOString(),
          totalStatements: statementsCount,
          totalObjects: objectsCount,
          totalQrCodes: qrCodesCount,
          totalPhotos: photosCount,
          totalProposedChanges: proposedChangesCount,
          totalInventoryBooks: inventoryBooksCount,
          totalInventoryBookItems: inventoryBookItemsCount,
        },
      };
    } catch (error) {
      this.logsService.log('offline_mode', userId || null, {
        action: 'offline_mode_error',
        userId: userId || null,
        error: error.message,
      });

      console.error('OfflineService: ошибка:', error);

      return {
        statements: [],
        objects: [],
        qr_codes: [],
        photos: [],
        proposed_changes: [],
        inventory_books: [],
        inventory_book_items: [],
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalStatements: 0,
          totalObjects: 0,
          totalQrCodes: 0,
          totalPhotos: 0,
          totalProposedChanges: 0,
          totalInventoryBooks: 0,
          totalInventoryBookItems: 0,
        },
      };
    }
  }

  /**
   * Синхронизирует изменения из офлайн-режима с онлайн-БД.
   * Делегирует выполнение в OfflineSyncService.applyChanges.
   * 
   * @param userId — ID пользователя, выполняющего синхронизацию
   * @param dto — DTO с изменениями (changes, inventoryBookItemChanges, proposedChangeActions)
   * @returns результат синхронизации с полями success, processed, inventoryItemsProcessed, message
   */
  async syncChanges(userId: number, dto: SyncChangesRequestDto): Promise<any> {
    console.log(`OfflineService: синхронизация ${dto.changes?.length || 0} изменений`);

    try {
      const result = await this.offlineSyncService.applyChanges(userId, dto);
      return {
        success: true,
        ...result,
        message: 'Синхронизация завершена',
      };
    } catch (error) {
      console.error('OfflineService: ошибка синхронизации:', error);
      return {
        success: false,
        message: `Ошибка синхронизации: ${error.message}`,
      };
    }
  }

  /**
   * Проверяет, нужна ли синхронизация при выходе из офлайн-режима.
   * Если локальных изменений нет — можно просто очистить кэш.
   * Если есть — требуется синхронизация.
   * 
   * @param localChanges — массив локальных изменений, переданный фронтом
   * @returns объект с полями:
   *   - success — успешность проверки
   *   - needsSync — true, если есть изменения для синхронизации
   *   - message — описание результата
   */
  checkIfSyncNeeded(localChanges: any[]): {
    success: boolean;
    needsSync: boolean;
    message: string;
  } {
    const changesCount = localChanges?.length || 0;
    console.log(`OfflineService: проверка синхронизации (изменений: ${changesCount})`);

    if (changesCount === 0) {
      return {
        success: true,
        needsSync: false,
        message: 'Нет локальных изменений. Можно переключаться.',
      };
    }

    return {
      success: true,
      needsSync: true,
      message: `Обнаружено ${changesCount} локальных изменений. Требуется синхронизация.`,
    };
  }

  /**
   * Подтверждает, что кэш может быть очищен.
   * Вызывается фронтом после успешной синхронизации или при отсутствии изменений.
   * 
   * @returns объект с полем success: true и сообщением
   */
  confirmCacheClear(): { success: boolean; message: string } {
    console.log('OfflineService: подтверждение очистки кэша');
    return {
      success: true,
      message: 'Кэш может быть очищен',
    };
  }
}