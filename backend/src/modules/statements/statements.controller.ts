import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatementsService } from './services/statements.service';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

/**
 * Контроллер для работы с ведомостями МОЛ.
 * 
 * ## Понятия
 * - **Ведомость** — группа строк из одного Excel-файла, полученного по email.
 *   Уникальная комбинация: userId + receivedAt + description.
 * - **Строка ведомости** — одна позиция в ведомости (инвентарный номер, партия и т.д.).
 * 
 * Базовый путь: /api/statements
 */
@Controller('statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(
    private readonly statementsService: StatementsService,
  ) {}

  // ============================================================================
  // СПИСОК ВЕДОМОСТЕЙ
  // ============================================================================

  /**
   * Получить список ведомостей текущего МОЛ.
   * GET /api/statements
   */
  @Get()
  async getList(
    @Req() request: RequestWithUser
  ): Promise<{ receivedAt: Date; description: string; docType: string; count: number }[]> {
    const userId = request.user.sub;
    if (!userId) {
      return [];
    }

    return await this.statementsService.getList(userId);
  }

  // ============================================================================
  // СТРОКИ ВЕДОМОСТИ
  // ============================================================================

  /**
   * Получить строки конкретной ведомости.
   * GET /api/statements/items?receivedAt=...
   */
  @Get('items')
  async getItems(
    @Req() request: RequestWithUser,
    @Query('receivedAt') receivedAt: string
  ) {
    const userId = request.user.sub;
    if (!userId) {
      return { statements: [] };
    }

    const statements = await this.statementsService.getItems(
      userId,
      new Date(receivedAt)
    );

    return { statements };
  }

  // ============================================================================
  // УДАЛЕНИЕ ВЕДОМОСТИ
  // ============================================================================

  /**
   * Удалить ведомость.
   * DELETE /api/statements?receivedAt=...
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteStatement(
    @Req() request: RequestWithUser,
    @Query('receivedAt') receivedAt: string
  ): Promise<{ success: boolean; message: string }> {
    const userId = request.user.sub;
    if (!userId) {
      return { success: false, message: 'Пользователь не найден' };
    }

    try {
      await this.statementsService.deleteStatement(userId, new Date(receivedAt));
      return { success: true, message: 'Ведомость удалена' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Ошибка при удалении ведомости',
      };
    }
  }

  // ============================================================================
  // ПОИСК ПО ИНВЕНТАРНОМУ НОМЕРУ
  // ============================================================================

  /**
   * Поиск записей ведомости по инвентарному номеру.
   * GET /api/statements/by-inv?inv=...&zavod=...&sklad=...&party=...
   */
  @Get('by-inv')
  async findByInv(
    @Query('inv') inv: string,
    @Query('receivedAt') receivedAt?: string,
    @Query('zavod') zavod?: string,
    @Query('sklad') sklad?: string,
    @Query('party') party?: string
  ) {
    try {
      if (!inv || inv.trim() === '') {
        return {
          success: false,
          error: 'Инвентарный номер обязателен',
          statements: [],
        };
      }

      const zavodValue = zavod ? parseInt(zavod, 10) : undefined;
      const skladValue = sklad || undefined;

      const statements = await this.statementsService.findByInv(
        inv.trim(),
        receivedAt ? new Date(receivedAt) : undefined,
        zavodValue,
        skladValue,
        party?.trim() || undefined
      );

      return {
        success: true,
        statements,
        count: statements.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statements: [],
      };
    }
  }

  // ============================================================================
  // ОБНОВЛЕНИЕ АКТУАЛЬНОСТИ
  // ============================================================================

  /**
   * Обновить статус актуальности для группы строк.
   * POST /api/statements/update-actual
   */
  @Post('update-actual')
  @HttpCode(HttpStatus.OK)
  async updateActual(
    @Req() request: RequestWithUser,
    @Body() body: { receivedAt: string; invNumber: string; isActual: boolean }
  ): Promise<{ success: boolean; updatedCount: number }> {
    const userId = request.user.sub;

    const updatedCount = await this.statementsService.updateActual(
      userId,
      new Date(body.receivedAt),
      body.invNumber,
      body.isActual
    );

    return { success: true, updatedCount };
  }
}