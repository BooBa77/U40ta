import {
  Controller,
  Get,
  Post,
  Patch,
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
import { RevisorAccessService } from './services/revisor-access.service';
import { InventoryStatement } from './entities/inventory-statement.entity';
import { UpdateInventoryBookDto } from './dto/update-inventory-book.dto';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService, // Для получения email пользователя
    private readonly revisorAccessService: RevisorAccessService, // Для настройки общего доступа к книгам
  ) {}

  /**
   * Получить email текущего пользователя по userId из JWT.
   * Возвращает null если пользователь не найден или email отсутствует.
   */
  private async getUserEmail(request: RequestWithUser): Promise<string | null> {
    const userId = request.user.sub;
    const user = await this.usersService.findById(userId);
    return user?.eMail || null;
  }  

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
    const email = await this.getUserEmail(request);
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
    const email = await this.getUserEmail(request);
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
    const email = await this.getUserEmail(request);
    if (!email) {
      return { success: false, message: 'Пользователь не найден или email отсутствует' };
    }

    try {
      await this.inventoryStatementsService.deleteBatch(
        email,
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
   * Обновить книгу (название и другие поля).
   * Только создатель.
   * PATCH /api/inventory/books/:id
   */
  @Patch('books/:id')
  async updateBook(
    @Req() request: RequestWithUser,
    @Param('id') id: number,
    @Body() body: UpdateInventoryBookDto
  ) {
    const userId = request.user.sub;
    const book = await this.inventoryBooksService.updateBook(id, userId, body);
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

  // ============================================================================
  // ДОСТУП К КНИГАМ
  // ============================================================================

  /**
   * Получить список ревизоров с доступом к книге.
   * GET /api/inventory/books/:id/access
   */
  @Get('books/:id/access')
  async getBookAccess(
    @Req() request: RequestWithUser,
    @Param('id') id: number
  ) {
    const access = await this.revisorAccessService.getAccessForBook(id);
    return { access };
  }

  /**
   * Добавить ревизора к книге.
   * POST /api/inventory/books/:id/access
   */
  @Post('books/:id/access')
  async addBookAccess(
    @Req() request: RequestWithUser,
    @Param('id') id: number,
    @Body() body: { userId: number }
  ) {
    await this.revisorAccessService.addAccess(id, body.userId);
    return { success: true };
  }

  /**
   * Удалить ревизора из книги.
   * DELETE /api/inventory/books/:id/access/:userId
   */
  @Delete('books/:id/access/:accessUserId')
  @HttpCode(HttpStatus.OK)
  async removeBookAccess(
    @Param('id') id: number,
    @Param('accessUserId') accessUserId: number
  ) {
    await this.revisorAccessService.removeAccess(id, accessUserId);
    return { success: true };
  }

  /**
   * Подтвердить наличие для строк книги.
   * POST /api/inventory/books/:id/items/confirm
   */
  @Post('books/:id/items/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmItems(
    @Req() request: RequestWithUser,
    @Param('id') bookId: number,
    @Body() body: {
      itemIds: number[];
      isOkManual?: boolean;
      isOkAuto?: boolean;
      rem?: string | null;
      idObject?: number | null;
      placeTer?: string | null;
      placePos?: string | null;
      placeCab?: string | null;
      placeUser?: string | null;
    }
  ): Promise<{ success: boolean; confirmedCount: number }> {
    const userId = request.user.sub;

    return await this.inventoryBooksService.confirmItems(
      bookId,
      body.itemIds,
      userId,
      {
        isOkManual: body.isOkManual,
        isOkAuto: body.isOkAuto,
        rem: body.rem,
        idObject: body.idObject,
        placeTer: body.placeTer,
        placePos: body.placePos,
        placeCab: body.placeCab,
        placeUser: body.placeUser,
      }
    );
  }  

  /**
   * Обновить статус актуальности для всех строк с указанным invNumber
   * POST /api/inventory/books/:id/items/update-actual
   */
  @Post('books/:id/items/update-actual')
  @HttpCode(HttpStatus.OK)
  async updateItemActual(
    @Req() request: RequestWithUser,
    @Param('id') bookId: number,
    @Body() body: { invNumber: string; isActual: boolean }
  ): Promise<{ success: boolean }> {
    const userId = request.user.sub;
    
    // Обновляем статус
    await this.inventoryBooksService.updateActualStatus(
      bookId,
      body.invNumber,
      body.isActual
    );
    
    return { success: true };
  }
  
  // ============================================================================
  // ВЫГРУЗКА КНИГИ В EXCEL
  // ============================================================================

  /**
   * Выгрузить книгу в Excel и отправить файл на почту текущему пользователю.
   * 
   * ## Процесс
   * 1. Получает email пользователя из JWT через getUserEmail
   * 2. Вызывает InventoryBooksService.exportBookToExcel
   * 3. Возвращает результат (success + сообщение для пользователя)
   * 
   * POST /api/inventory/books/:id/export-excel
   * 
   * @param request - запрос с JWT-токеном
   * @param id - ID книги
   * @returns Объект { success: boolean, message: string }
   */
  @Post('books/:id/export-excel')
  @HttpCode(HttpStatus.OK)
  async exportBookToExcel(
    @Req() request: RequestWithUser,
    @Param('id') id: number,
  ): Promise<{ success: boolean; message: string }> {
    const userId = request.user.sub;
    const userEmail = await this.getUserEmail(request);

    if (!userEmail) {
      return { success: false, message: 'Не удалось определить email пользователя' };
    }

    return await this.inventoryBooksService.exportBookToExcel(id, userId, userEmail);
  }  
}