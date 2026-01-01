import { Injectable } from '@nestjs/common';

@Injectable()
export class OfflineCacheService {
  constructor() {}

  // Собирает все данные для офлайн-режима
  async getAllData(userId: number): Promise<any> {
    throw new Error('Метод не реализован');
  }
}