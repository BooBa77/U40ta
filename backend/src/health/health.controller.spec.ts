import { describe, it, expect, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

/**
 * Тесты проверки живости.
 *
 * Смысл маршрута — отличить «процесс запущен» от «работает с базой». Поэтому
 * проверяется и успешный ответ, и то, что недоступная база даёт ошибку, а не
 * бодрое `ok`: иначе мониторинг будет молчать о реальной аварии.
 */
describe('HealthController', () => {
  function controllerWith(query: () => Promise<unknown>): HealthController {
    const dataSource = { query } as unknown as DataSource;
    return new HealthController(dataSource);
  }

  it('отвечает ok и временем ответа базы', async () => {
    const controller = controllerWith(async () => [{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('ok');
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('делает запрос к базе, а не просто отвечает ok', async () => {
    const query = vi.fn(async () => [{ '?column?': 1 }]);

    await controllerWith(query).check();

    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('недоступная база — это ошибка, а не ok', async () => {
    const controller = controllerWith(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(controller.check()).rejects.toThrow('ECONNREFUSED');
  });
});
