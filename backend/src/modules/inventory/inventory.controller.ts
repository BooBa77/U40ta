import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryStatementsService } from './services/inventory-statements.service';
import { InventoryStatement } from './entities/inventory-statement.entity';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

/**
 * Контроллер для работы с инвентаризационными ведомостями ревизора.
 * 
 * ## Понятия
 * - **Batch (пакет)** — группа строк из одного Excel-файла. Уникальная комбинация:
 *   emailFrom + receivedAt + zavod + sklad.
 * - **Книга** — сводная инвентаризационная ведомость, которую ревизор собирает
 *   из выбранных batch'ей. Будет реализована позже.
 * 
 * Базовый путь: /api/inventory
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard) // JWT-аутентификация для всех эндпоинтов
export class InventoryController {
  constructor(
    private readonly inventoryStatementsService: InventoryStatementsService,
  ) {}

  /**
   * Получить список уникальных batch'ей (пакетов) ревизора.
   * Каждый batch — это группа строк из одного Excel-файла.
   * Сгруппировано по emailFrom + receivedAt + zavod + sklad.
   * 
   * GET /api/inventory/batches
   */
  @Get('batches')
  async getBatches(
    @Req() request: RequestWithUser
  ): Promise<{ emailFrom: string; receivedAt: Date; zavod: number; sklad: string; docType: string; count: number }[]> {
    const email = request.user.email;
    if (!email) {
      return [];
    }

    return await this.inventoryStatementsService.getBatches(email);
  }

  /**
   * Получить все строки конкретного batch'а.
   * Используется в модалке для просмотра и копирования строк в книгу.
   * 
   * GET /api/inventory/batches/items
   * Параметры query: emailFrom, receivedAt, zavod, sklad
   */
  @Get('batches/items')
  async getBatchItems(
    @Req() request: RequestWithUser,
    @Query('emailFrom') emailFrom: string,
    @Query('receivedAt') receivedAt: string,
    @Query('zavod') zavod: number,
    @Query('sklad') sklad: string
  ): Promise<InventoryStatement[]> {
    const email = request.user.email;
    if (!email) {
      return [];
    }

    return await this.inventoryStatementsService.getBatchItems(
      email,
      new Date(receivedAt),
      Number(zavod),
      sklad
    );
  }

  /**
   * Удалить все строки конкретного batch'а.
   * 
   * DELETE /api/inventory/batches
   * Параметры query: emailFrom, receivedAt, zavod, sklad
   */
  @Delete('batches')
  @HttpCode(HttpStatus.OK)
  async deleteBatch(
    @Req() request: RequestWithUser,
    @Query('emailFrom') emailFrom: string,
    @Query('receivedAt') receivedAt: string,
    @Query('zavod') zavod: number,
    @Query('sklad') sklad: string
  ): Promise<{ success: boolean; message: string }> {
    if (!request.user.email) {
      return { success: false, message: 'Пользователь не аутентифицирован' };
    }

    try {
      await this.inventoryStatementsService.deleteBatch(
        request.user.email,
        new Date(receivedAt),
        Number(zavod),
        sklad
      );
      return { success: true, message: 'Пакет удалён' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Ошибка при удалении пакета'
      };
    }
  }
}