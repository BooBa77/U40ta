import { Controller, Get, Post, Body, UseGuards, UsePipes, ValidationPipe, Req, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfflineService } from './services/offline.service';
import { OfflineDataResponseDto } from './dto/offline-data.response.dto';
import { SyncChangesRequestDto } from './dto/sync-changes.request.dto';
import { errorMessage, errorStack } from '../../common/utils/error';

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
        message: `Ошибка загрузки данных: ${errorMessage(error)}`,
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
      this.logger.error(`OfflineController: ошибка проверки: ${errorMessage(error)}`, errorStack(error));
      return {
        success: false,
        needsSync: true,
        message: `Ошибка проверки: ${errorMessage(error)}`,
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
  // Валидация формы запроса (см. SyncChangesRequestDto): проверяются только
  // списки верхнего уровня. `whitelist: false` — намеренно: тело содержит
  // вложенные структуры, которые DTO подробно не описывает, и вырезать
  // незнакомые поля было бы потерей данных.
  @UsePipes(new ValidationPipe({ whitelist: false, transform: false }))
  async syncChanges(
    @Req() request: any,
    @Body() body: SyncChangesRequestDto,
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
        message: `Ошибка синхронизации: ${errorMessage(error)}`,
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