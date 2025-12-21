import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { StatementService } from './services/statement.service';

@Controller('statements')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class StatementsController {
  constructor(private readonly parserService: StatementService) {}

  /**
   * Открытие ведомости по ID вложения из email
   * GET /api/statements/:attachmentId
   */
  @Get(':attachmentId')
  async getStatement(@Param('attachmentId') attachmentId: number) {
    try {
      // Просто вызываем сервис парсинга
      const statements = await this.parserService.parseStatement(attachmentId);
      
      // Простой ответ
      return {
        success: true,
        attachmentId,
        statements,
        count: statements.length,
        message: `Загружено ${statements.length} строк`
      };
      
    } catch (error) {
      // Простая обработка ошибки
      return {
        success: false,
        attachmentId,
        statements: [],
        count: 0,
        error: error.message
      };
    }
  }
}