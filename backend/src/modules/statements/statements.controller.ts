// statements.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { StatementService } from './services/statement.service';
import { GetStatementParamsDto } from './dto/get-statement-params.dto';
import { StatementResponseDto } from './dto/statement-response.dto';

@Controller('statements')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class StatementsController {
  constructor(private readonly statementService: StatementService) {}  

  /**
   * Открытие ведомости по ID вложения из email
   * GET /api/statements/:attachmentId
   */
  @Get(':attachmentId')
  async getStatement(@Param() params: GetStatementParamsDto): Promise<StatementResponseDto> {
    try {
      // Преобразуем строку в число (attachmentId из @Param всегда строка)
      const attachmentId = parseInt(params.attachmentId, 10);
      
      // Вызываем сервис
      const statements = await this.statementService.parseStatement(attachmentId);
      
      // Возвращаем типизированный ответ
      const response = new StatementResponseDto();
      response.success = true;
      response.attachmentId = attachmentId;
      response.statements = statements;
      response.count = statements.length;
      response.message = `Загружено ${statements.length} строк`;
      
      return response;
      
    } catch (error) {
      const response = new StatementResponseDto();
      response.success = false;
      response.attachmentId = parseInt(params.attachmentId, 10) || 0;
      response.statements = [];
      response.count = 0;
      response.error = error.message;
      
      return response;
    }
  }
}