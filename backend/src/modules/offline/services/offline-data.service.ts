import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectOfflineChange } from '../entities/offline-object-change.entity';

@Injectable()
export class OfflineDataService {
  constructor(
    @InjectRepository(ObjectOfflineChange)
    private readonly offlineChangesRepository: Repository<ObjectOfflineChange>,
  ) {}

  // Сохраняет изменения сделанные в оффлайне
  async saveOfflineChanges(changes: any[]): Promise<void> {
    throw new Error('Метод не реализован');
  }

  // Очищает временные изменения после синхронизации
  async clearOfflineChanges(): Promise<void> {
    throw new Error('Метод не реализован');
  }

  // Получает все offline изменения (для отладки)
  async findAll(): Promise<ObjectOfflineChange[]> {
    throw new Error('Метод не реализован');
  }
}