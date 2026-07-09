import { Controller, Post, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MolService } from './mol.service';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Controller('mol')
export class MolController {
  constructor(private readonly molService: MolService) {}

  /**
   * Экспорт доступных объектов МОЛа в Excel
   * POST /api/mol/export-excel
   * 
   * Бэкенд самостоятельно:
   * 1. Получает список складов пользователя через /api/users/me/mol-access
   * 2. Собирает все объекты по этим складам
   * 3. Собирает логи по этим объектам из таблицы logs (source='object-history')
   * 4. Формирует Excel с двумя листами:
   *    - Лист 1: Данные объектов (все поля из таблицы)
   *    - Лист 2: Логи (дата, сотрудник, тип события, событие)
   * 5. Отправляет на почту пользователю
   * 
   * @returns { success: boolean, message: string }
   */
  @Post('export-excel')
  @UseGuards(JwtAuthGuard)
  async exportExcel(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }

    return await this.molService.exportExcel(userId);
  }
}