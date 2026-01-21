import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { StatementService } from './services/statement.service';
import { StatementResponseDto } from './dto/statement-response.dto';
import { UpdateIgnoreDto } from './dto/update-ignore.dto';

@Controller('statements')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class StatementsController {
  constructor(private readonly statementService: StatementService) {}  

  /**
   * Открытие ведомости по ID вложения из email
   * GET /api/statements/:attachmentId
   */
  @Get(':attachmentId')
  async getStatement(
    @Param('attachmentId', ParseIntPipe) attachmentId: number
  ): Promise<StatementResponseDto> {
    try {
      // attachmentId число благодаря ParseIntPipe
      const statements = await this.statementService.parseStatement(attachmentId);
      
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
      response.attachmentId = attachmentId;
      response.statements = [];
      response.count = 0;
      response.error = error.message;
      
      return response;
    }
  }

/**
 * Обновление статуса игнорирования для группы строк
 * Обновляет все строки с указанным inv_number и party_number
 * POST /api/statements/ignore
 */
  @Post('ignore')
  async updateIgnoreStatus(
    @Body() dto: UpdateIgnoreDto
  ): Promise<StatementResponseDto> {
    try {
      const updated = await this.statementService.updateIgnoreStatus(dto);
      
      const response = new StatementResponseDto();
      response.success = true;
      response.attachmentId = dto.attachmentId;
      response.statements = updated;
      response.count = updated.length;
      response.message = `Обновлено ${updated.length} записей`;
      
      return response;
    } catch (error) {
      const response = new StatementResponseDto();
      response.success = false;
      response.attachmentId = dto.attachmentId;
      response.statements = [];
      response.count = 0;
      response.error = error.message;
      
      return response;
    }
  }  
}