import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProposedChangesService } from './proposed-changes.service';
import { CreateProposedChangesBatchDto } from './dto/create-proposed-change.dto';
import { UsersService } from '../users/users.service';

/**
 * Интерфейс запроса с данными пользователя из JWT.
 */
interface RequestWithUser extends ExpressRequest {
  user?: { sub: number };
}

/**
 * Контроллер для работы с предлагаемыми изменениями.
 * 
 * ## Назначение
 * - Гости создают предлагаемые изменения
 * - МОЛ просматривает и удаляет (после применения/отклонения на фронте)
 * 
 * Базовый путь: /api/proposed-changes
 */
@Controller('proposed-changes')
@UseGuards(JwtAuthGuard)
export class ProposedChangesController {
  constructor(
    private readonly proposedChangesService: ProposedChangesService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Создать пакет предлагаемых изменений от гостя.
   * 
   * POST /api/proposed-changes
   * 
   * @param dto — DTO с массивом изменений
   * @param request — запрос с JWT-токеном для получения userId
   * @returns Массив созданных записей ProposedChange
   * @throws UnauthorizedException если пользователь не авторизован
   */
  @Post()
  async createBatch(
    @Body() dto: CreateProposedChangesBatchDto,
    @Req() request: RequestWithUser,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    return this.proposedChangesService.createBatch(dto.changes, userId);
  }

  /**
   * Получение списка предлагаемых изменений.
   * 
   * Если указаны zavod/sklad — фильтрует только по указанному складу.
   * Иначе возвращает все изменения для складов, доступных текущему МОЛу.
   * 
   * GET /api/proposed-changes
   * GET /api/proposed-changes?zavod=1&sklad=А
   * 
   * @param request — запрос с JWT-токеном
   * @param zavod — опциональный фильтр по заводу
   * @param sklad — опциональный фильтр по складу
   * @returns Массив записей ProposedChange
   */
  @Get()
  async findAll(
    @Req() request: RequestWithUser,
    @Query('zavod') zavod?: string,
    @Query('sklad') sklad?: string,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }

    // Фильтр по конкретному складу
    if (zavod && sklad) {
      return this.proposedChangesService.findByMolAccess([
        { zavod: parseInt(zavod, 10), sklad }
      ]);
    }

    // Получаем все склады МОЛа из mol_access
    const molAccess = await this.usersService.getMolAccess(userId);
    return this.proposedChangesService.findByMolAccess(molAccess);
  }

  /**
   * Удаление записи предлагаемого изменения.
   * Вызывается фронтом после применения (approved) или отклонения (rejected).
   * Если запись содержит photo_id и решение rejected — фото удалится каскадно.
   * 
   * DELETE /api/proposed-changes/:id
   * 
   * @param id — ID записи
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.proposedChangesService.remove(+id);
    return { success: true };
  }
}