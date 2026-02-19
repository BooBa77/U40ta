import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ObjectChangesService } from './objects_changes.service';
import { ObjectChangeResponseDto } from './dto/object-change.response.dto';

@Controller('object-changes')
@UseGuards(JwtAuthGuard)
export class ObjectChangesController {
  constructor(private readonly objectChangesService: ObjectChangesService) {}

  /**
   * Получение истории изменений объекта
   * GET /api/object-changes/:objectId
   */
  @Get(':objectId')
  async getObjectHistory(
    @Param('objectId') objectId: string,
  ): Promise<ObjectChangeResponseDto[]> {
    try {
      const history = await this.objectChangesService.getObjectHistory(+objectId);
      
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
   * POST /api/object-changes
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

      const change = await this.objectChangesService.logChange({
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