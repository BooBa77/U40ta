import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ObjectHistoryService } from './object_history.service';
import { ObjectHistoryResponseDto } from './dto/object_history.response.dto';

@Controller('object-history')
@UseGuards(JwtAuthGuard)
export class ObjectHistoryController {
  constructor(private readonly objectHistoryService: ObjectHistoryService) {}

  /**
   * Получение истории изменений объекта
   * GET /api/object-history/:objectId
   */
  @Get(':objectId')
  async getObjectHistory(
    @Param('objectId') objectId: string,
  ): Promise<ObjectHistoryResponseDto[]> {
    try {
      const history = await this.objectHistoryService.getObjectHistory(+objectId);
      
      // Преобразуем в DTO
      return history.map(change => ({
        id: change.id,
        object_id: change.object_id,
        story_line: change.story_line,
        changed_by: change.changed_by,
        changed_at: change.changed_at,
      }));
    } catch (error) {
      console.error(`Ошибка получения истории объекта ${objectId}:`, error);
      throw error;
    }
  }

  /**
   * Добавление записи в историю
   * POST /api/object-history
   */
  @Post()
  async addHistoryRecord(
    @Body() body: { object_id: number; story_line: string },
    @Req() request: any,
  ) {
    try {
      const userId = request.user?.sub || request.user?.userId;
      
      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      const change = await this.objectHistoryService.logHistory({
        object_id: body.object_id,
        story_line: body.story_line,
        changed_by: userId,
      });

      return {
        success: true,
        data: change,
        message: 'Запись добавлена в историю',
      };
    } catch (error) {
      console.error('Ошибка добавления записи в историю:', error);
      return {
        success: false,
        message: `Ошибка: ${error.message}`,
      };
    }
  }
}