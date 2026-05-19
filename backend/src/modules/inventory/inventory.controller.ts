import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryStatementsService } from './services/inventory-statements.service';
import { InventoryBooksService } from './services/inventory-books.service';
import { InventoryStatement } from './entities/inventory-statement.entity';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

/**
 * Контроллер для работы с инвентаризационными ведомостями ревизора.
 * 
 * ## Понятия
 * - **Batch (пакет)** — группа строк из одного Excel-файла. Уникальная комбинация:
 *   emailFrom + receivedAt + zavod + sklad.
 * - **Книга** — сводная инвентаризационная ведомость, которую ревизор собирает
 *   из выбранных batch'ей.
 * 
 * Базовый путь: /api/inventory
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryStatementsService: InventoryStatementsService,
    private readonly inventoryBooksService: InventoryBooksService,
  ) {}

  // ============================================================================
  // BATCH'И (ПАКЕТЫ СТРОК ИЗ EXCEL-ФАЙЛОВ)
  // ============================================================================

  /**
   * Получить список уникальных batch'ей ревизора.
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
   * GET /api/inventory/batches/items
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
   * DELETE /api/inventory/batches
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

  // ============================================================================
  // КНИГИ (ИНВЕНТАРИЗАЦИОННЫЕ СВОДНЫЕ ВЕДОМОСТИ)
  // ============================================================================

  /**
   * Получить все книги, доступные ревизору.
   * GET /api/inventory/books
   */
  @Get('books')
  async getBooks(@Req() request: RequestWithUser) {
    const userId = request.user.sub;
    if (!userId) {
      return { books: [] };
    }

    const books = await this.inventoryBooksService.getBooks(userId);
    return { books };
  }

  /**
   * Получить одну книгу по ID.
   * GET /api/inventory/books/:id
   */
  @Get('books/:id')
  async getBook(
    @Req() request: RequestWithUser,
    @Param('id') id: number
  ) {
    const userId = request.user.sub;
    const book = await this.inventoryBooksService.getBook(id, userId);
    return { book };
  }

  /**
   * Получить строки книги.
   * GET /api/inventory/books/:id/items
   */
  @Get('books/:id/items')
  async getBookItems(
    @Req() request: RequestWithUser,
    @Param('id') id: number
  ) {
    const userId = request.user.sub;
    const items = await this.inventoryBooksService.getBookItems(id, userId);
    return { items };
  }

  /**
   * Создать новую книгу.
   * POST /api/inventory/books
   */
  @Post('books')
  async createBook(
    @Req() request: RequestWithUser,
    @Body() body: { name: string; items: any[] }
  ) {
    const userId = request.user.sub;
    const book = await this.inventoryBooksService.createBook(userId, body.name, body.items);
    return { book };
  }

  /**
   * Удалить книгу (только создатель).
   * DELETE /api/inventory/books/:id
   */
  @Delete('books/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBook(
    @Req() request: RequestWithUser,
    @Param('id') id: number
  ) {
    const userId = request.user.sub;
    await this.inventoryBooksService.deleteBook(id, userId);
    return { success: true, message: 'Книга удалена' };
  }
}