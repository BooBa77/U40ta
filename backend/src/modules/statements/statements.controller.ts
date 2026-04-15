import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, HttpCode, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { StatementService } from './services/statement.service';
import { StatementObjectsService } from './services/statement-objects.service';
import { UpdateIgnoreDto } from './dto/update-ignore.dto';
import { UpdateHaveObjectDto } from './dto/update-have-object.dto';

@Controller('statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(
    private readonly statementService: StatementService,
    private readonly statementObjectsService: StatementObjectsService,
  ) {}

  /**
   * Поиск записей ведомости по инвентарному номеру по определённому складу без учёта party
   * GET /api/statements/by-inv?inv=...&zavod=...&sklad=...
   * Только записи с haveObject = false (те, по которым нужно создать объект)
   */
  @Get('by-inv')
  async findByInv(
    @Query('inv') inv: string,
    @Query('zavod') zavod?: string,
    @Query('sklad') sklad?: string
  ) {
    try {
      console.log(`[StatementsController] Поиск записей ведомости по inv=${inv}, zavod=${zavod}, sklad=${sklad}`);
      
      if (!inv || inv.trim() === '') {
        return {
          success: false,
          error: 'Инвентарный номер обязателен',
          statements: []
        };
      }
      
      const zavodValue = zavod ? parseInt(zavod, 10) : undefined;
      const skladValue = sklad || undefined;
      
      const statements = await this.statementService.findByInv(
        inv.trim(),
        zavodValue,
        skladValue
      );
      
      return {
        success: true,
        statements: statements,
        count: statements.length
      };
    } catch (error) {
      console.error('[StatementsController] Ошибка поиска записей ведомости:', error);
      return {
        success: false,
        error: error.message,
        statements: []
      };
    }
  }

  /**
   * Открытие ведомости по ID вложения из email
   * GET /api/statements/:attachmentId
   */
  @Get(':attachmentId')
  async getStatement(
    @Param('attachmentId', ParseIntPipe) attachmentId: number
  ) {
    try {
      const statements = await this.statementService.parseStatement(attachmentId);
      
      return {
        success: true,
        attachmentId: attachmentId,
        statements: statements,
        count: statements.length,
        message: `Загружено ${statements.length} строк`
      };
      
    } catch (error) {
      return {
        success: false,
        attachmentId: attachmentId,
        statements: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Обновление статуса игнорирования для группы строк
   * POST /api/statements/ignore
   */
  @Post('ignore')
  async updateIgnoreStatus(@Body() dto: UpdateIgnoreDto) {
    try {
      const updated = await this.statementService.updateIgnoreStatus(dto);
      
      return {
        success: true,
        attachmentId: dto.attachmentId,
        statements: updated,
        count: updated.length,
        message: `Обновлено ${updated.length} записей`
      };
    } catch (error) {
      return {
        success: false,
        attachmentId: dto.attachmentId,
        statements: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Обновление статуса haveObject для конкретной строки ведомости
   * POST /api/statements/update-have-object
   */
  @Post('update-have-object')
  @HttpCode(204)
  async updateHaveObject(@Body() dto: UpdateHaveObjectDto): Promise<void> {
    await this.statementObjectsService.updateSingleHaveObject(dto.statementId);
  }
}