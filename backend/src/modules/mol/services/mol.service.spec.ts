import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { MolService } from './mol.service';

/**
 * Тесты сборки запроса «объекты по складам пользователя».
 *
 * Проверяется главное свойство: условия строятся **параметрами**, а не
 * подстановкой значений в текст SQL. Раньше завод и склад склеивались прямо в
 * условие (`sklad = '${s.sklad}'`) — инъекции не было только потому, что
 * значения приходят из базы, но заметить подмену источника данных было бы нечем.
 * Тест ловит возврат к склейке.
 *
 * Сервис создаётся напрямую с заглушками: контейнер NestJS и база не нужны.
 */
describe('MolService.getObjectsForUser', () => {
  beforeEach(() => {
    // Сервис пишет в лог на каждый вызов — иначе вывод тестов тонет в строках Nest.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Заглушка репозитория: запоминает, что именно ей передали. */
  function buildService(molAccess: { zavod: number; sklad: string }[]) {
    const query = {
      where: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
      setParameter: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => [{ id: 1, invNumber: '0001' }]),
    };
    const objectRepository = { createQueryBuilder: vi.fn(() => query) };
    const usersService = { getMolAccess: vi.fn(async () => molAccess) };

    const service = new MolService(
      objectRepository as never,
      {} as never,
      {} as never,
      usersService as never,
    );

    return { service, query, objectRepository, usersService };
  }

  it('передаёт завод и склад параметрами, а не значениями в тексте условия', async () => {
    const { service, query } = buildService([
      { zavod: 1, sklad: 'S010' },
      { zavod: 0, sklad: '04003040' },
    ]);

    await service.getObjectsForUser(7);

    // Условия — только имена параметров. Точное сравнение вместо «не содержит
    // значения»: цифры есть и в именах параметров, поэтому проверка на вхождение
    // была бы бессмысленной.
    expect(query.where).toHaveBeenCalledWith(
      '(obj.zavod = :zavod_0 AND obj.sklad = :sklad_0)',
    );
    expect(query.orWhere).toHaveBeenCalledWith(
      '(obj.zavod = :zavod_1 AND obj.sklad = :sklad_1)',
    );

    // Значения уходят отдельно — значит, экранированием занимается драйвер.
    expect(query.setParameter).toHaveBeenCalledWith('zavod_0', 1);
    expect(query.setParameter).toHaveBeenCalledWith('sklad_0', 'S010');
    expect(query.setParameter).toHaveBeenCalledWith('zavod_1', 0);
    expect(query.setParameter).toHaveBeenCalledWith('sklad_1', '04003040');
  });

  it('берёт склады из доступов пользователя', async () => {
    const { service, usersService } = buildService([{ zavod: 2, sklad: 'S017' }]);

    await service.getObjectsForUser(42);

    expect(usersService.getMolAccess).toHaveBeenCalledWith(42);
  });

  it('без доступных складов в базу не ходит', async () => {
    const { service, objectRepository } = buildService([]);

    const result = await service.getObjectsForUser(7);

    expect(result).toEqual([]);
    expect(objectRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('сортирует результат по заводу, складу и инвентарному номеру', async () => {
    const { service, query } = buildService([{ zavod: 1, sklad: 'S010' }]);

    await service.getObjectsForUser(7);

    expect(query.orderBy).toHaveBeenCalledWith('obj.zavod', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('obj.sklad', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('obj.invNumber', 'ASC');
  });
});
