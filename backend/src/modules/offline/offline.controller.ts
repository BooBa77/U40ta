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
  async getOfflineData(@Req() request: any): Promise<OfflineDataResponseDto> {
    try {
      const userId = request.user?.sub || request.user?.userId;
      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      // Передаем userId в сервис
      const offlineData = await this.offlineService.getOfflineData(userId);
      
      return {
        success: true,
        data: offlineData,
        message: 'ВСЕ данные для офлайн-режима успешно загружены',
      };
      
    } catch (error) {
      // Возвращаем пустые данные
      return {
        success: false,
        data: {
          objects: [],
          processed_statements: [],
          object_changes: [],
          qr_codes: [],
          meta: { // ← добавляем meta в случае ошибки
            userId: 0,
            fetchedAt: new Date().toISOString(),
            totalObjects: 0,
            totalStatements: 0,
            totalObjectChanges: 0,
            totalQrCodes: 0,
            accessibleSklads: 0,
          }
        },
        message: `Ошибка загрузки данных: ${error.message}`,
      };
    }
  }

  /**
   * Проверка совершённых действий в офлайн-режиме. Есть ли чего выгружать или просто кэш очищаем
   * POST /api/offline/check-switch-to-online
   */
  @Post('check-switch-to-online')
  async checkSwitchToOnline(
    @Req() request: any,
    @Body() body: { localChangesHistory?: any[] }
  ) {
    try {
      const userId = request.user?.sub || request.user?.userId;
      const localChanges = body.localChangesHistory || [];
      
      console.log(`OfflineController: проверка перехода в онлайн для пользователя ${userId}`);
      console.log(`OfflineController: получено локальных изменений: ${localChanges.length}`);
      console.log(`OfflineController: тип данных: ${typeof localChanges}`);
      console.log(`OfflineController: данные:`, localChanges);
      
      const checkResult = this.offlineService.checkIfSyncNeeded(localChanges);
      
      console.log(`OfflineController: результат проверки:`, {
        needsSync: checkResult.needsSync,
        message: checkResult.message,
        clearCache: !checkResult.needsSync
      });
      
      return {
        success: true,
        needsSync: checkResult.needsSync,
        message: checkResult.message,
        clearCache: !checkResult.needsSync,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OfflineController: ошибка проверки:', error);
      return {
        success: false,
        needsSync: true,
        message: `Ошибка проверки: ${error.message}`,
        clearCache: false,
        timestamp: new Date().toISOString(),
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