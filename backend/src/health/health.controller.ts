import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * Проверка живости сервиса.
 *
 * Маршрут намеренно **без авторизации**: его дёргают мониторинг, cron и сам
 * деплой — после `docker compose up -d` первым делом проверяется
 * `curl https://u40ta.booba.fvds.ru/api/health`. Путь и формат ответа совпадают
 * с `ph`, чтобы оба проекта проверялись одинаково.
 *
 * Запрос `SELECT 1` здесь не формальность: он проверяет не «процесс запущен», а
 * что приложение действительно работает с базой. Если база недоступна, маршрут
 * ответит ошибкой — и это правильный сигнал, а не ложное «ok».
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const started = Date.now();
    await this.dataSource.query('SELECT 1');
    return {
      status: 'ok',
      db: 'ok',
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
  }
}
