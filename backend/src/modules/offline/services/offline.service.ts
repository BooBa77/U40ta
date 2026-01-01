import { Injectable } from '@nestjs/common';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineSyncService } from './offline-sync.service';

@Injectable()
export class OfflineService {
  constructor(
    private readonly offlineCacheService: OfflineCacheService,
    private readonly offlineSyncService: OfflineSyncService,
  ) {}

  // Основной метод для получения данных для кэширования
  async getOfflineData(userId: number): Promise<any> {
    // Будет делегировать в OfflineCacheService
    throw new Error('Метод не реализован');
  }

  // Основной метод для синхронизации изменений
  async syncChanges(userId: number, changes: any[]): Promise<any> {
    // Будет делегировать в OfflineSyncService
    throw new Error('Метод не реализован');
  }
}