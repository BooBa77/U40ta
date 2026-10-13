import { Controller, Get, Post, Body, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfflineService } from './services/offline.service';
import { OfflineDataResponseDto } from './dto/offline-data.response.dto';

@ApiTags('offline')
@Controller('offline')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class OfflineController {
  private readonly logger = new Logger(OfflineController.name);

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
          statements: [],
          qr_codes: [],
          photos: [],
          proposed_changes: [],
          inventory_books: [],
          inventory_book_items: [],
          ignore_keywords: [],
          meta: {
            userId: 0,
            fetchedAt: new Date().toISOString(),
            totalStatements: 0,
            totalObjects: 0,
            totalQrCodes: 0,
            totalPhotos: 0,
            totalProposedChanges: 0,
            totalInventoryBooks: 0,
            totalInventoryBookItems: 0,
            totalIgnoreKeywords: 0,
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
      
      this.logger.debug(`OfflineController: проверка перехода в онлайн для пользователя ${userId}`);
      this.logger.debug(`OfflineController: получено локальных изменений: ${localChanges.length}`);
      
      const checkResult = this.offlineService.checkIfSyncNeeded(localChanges);
      
      this.logger.debug(
        `OfflineController: результат проверки: needsSync=${checkResult.needsSync}, ` +
        `message=${checkResult.message}, clearCache=${!checkResult.needsSync}`,
      );
      
      return {
        success: true,
        needsSync: checkResult.needsSync,
        message: checkResult.message,
        clearCache: !checkResult.needsSync,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`OfflineController: ошибка проверки: ${error.message}`, error.stack);
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
  //@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
  async syncChanges(
    @Req() request: any,
    @Body() body: any,
    //@Body() body: SyncChangesRequestDto,
  ) {
    try {
      const userId = request.user?.sub || request.user?.userId;
      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      const result = await this.offlineService.syncChanges(userId, body);

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