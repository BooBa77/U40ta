import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfflineService } from './services/offline.service';
import { OfflineDataResponseDto } from './dto/offline-data.response.dto';

@Controller('offline')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class OfflineController {
  constructor(private readonly offlineService: OfflineService) {}

  /**
   * Получение всех данных для офлайн-режима
   * GET /api/offline/data
   */
  @Get('data')
  async getOfflineData(): Promise<OfflineDataResponseDto> {
    try {
      // Получаем ВСЕ данные без фильтрации по пользователю
      const data = await this.offlineService.getOfflineData();
      
      return {
        success: true,
        data,
        message: 'ВСЕ данные для офлайн-режима успешно загружены',
      };
      
    } catch (error) {
      // Возвращаем ошибку с пустыми данными
      return {
        success: false,
        data: {
          objects: [],
          places: [],
          processed_statements: [],
          object_changes: [],
          qr_codes: [],
        },
        message: `Ошибка загрузки данных: ${error.message}`,
      };
    }
  }


  /**
   * Синхронизация изменений из офлайн-режима
   * POST /api/offline/sync
   */
  @Post('sync')
  async syncChanges(@Req() request: any, @Body() body: any) {
    try {
      const userId = request.user?.sub || request.user?.userId;
      const changes = body.changes || [];
      
      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      const result = await this.offlineService.syncChanges(userId, changes);
      
      return {
        success: true,
        ...result,
        message: 'Изменения успешно синхронизированы',
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Ошибка синхронизации: ${error.message}`,
      };
    }
  }

  /**
   * Получение статуса синхронизации
   * GET /api/offline/status
   */
  @Get('status')
  async getSyncStatus(@Req() request: any) {
    const userId = request.user?.sub || request.user?.userId;
    return {
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      message: 'Endpoint для статуса синхронизации',
    };
  }
}