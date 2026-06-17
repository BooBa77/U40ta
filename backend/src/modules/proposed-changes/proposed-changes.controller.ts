import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProposedChangesService } from './proposed-changes.service';
import { CreateProposedChangesBatchDto } from './dto/create-proposed-change.dto';

/**
 * Интерфейс запроса с данными пользователя из JWT.
 * Используется для получения userId авторизованного пользователя.
 */
interface RequestWithUser extends ExpressRequest {
  user?: { sub: number };
}

/**
 * Контроллер для работы с предлагаемыми изменениями от гостей.
 * 
 * ## Назначение
 * Гости (пользователи без доступа МОЛ к складу) предлагают правки объектов.
 * МОЛ в админке подтверждает или отклоняет эти правки.
 * 
 * Базовый путь: /api/proposed-changes
 */
@Controller('proposed-changes')
@UseGuards(JwtAuthGuard)
export class ProposedChangesController {
  constructor(private readonly proposedChangesService: ProposedChangesService) {}

  /**
   * Создать пакет предлагаемых изменений от гостя.
   * 
   * ## Процесс
   * 1. Извлекает userId из JWT-токена
   * 2. Если пользователь не авторизован — выбрасывает UnauthorizedException
   * 3. Сохраняет все изменения в БД со статусом `pending`
   * 
   * ## Пример тела запроса
   * ```json
   * {
   *   "changes": [
   *     { "objectId": 123, "changeType": "place", "proposedData": { "placeTer": "Территория А", ... } },
   *     { "objectId": 123, "changeType": "sn", "proposedData": { "sn": "ABC123" } },
   *     { "objectId": 123, "changeType": "comment", "proposedData": { "comment": "Перемещён в кабинет 101" } }
   *   ]
   * }
   * ```
   * 
   * POST /api/proposed-changes
   * 
   * @param dto — DTO с массивом изменений (объект, тип, данные)
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
}