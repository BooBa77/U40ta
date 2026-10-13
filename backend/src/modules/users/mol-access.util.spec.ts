import { describe, it, expect } from 'vitest';
import { hasMolAccess } from './mol-access.util';

/**
 * Тесты проверки доступа МОЛа к складу.
 *
 * По этой функции решается, может ли пользователь утвердить предлагаемое
 * изменение, поэтому важны обе стороны: и что доступ находится, и что при
 * отсутствии доступа (или незаполненном складе) он не «находится» случайно.
 */
describe('hasMolAccess', () => {
  const access = [
    { zavod: 1, sklad: 'Основной' },
    { zavod: 2, sklad: 'ОС' },
  ];

  it('находит склад из списка', () => {
    expect(hasMolAccess(access, 1, 'Основной')).toBe(true);
    expect(hasMolAccess(access, 2, 'ОС')).toBe(true);
  });

  it('не находит чужой склад', () => {
    expect(hasMolAccess(access, 3, 'Основной')).toBe(false);
    expect(hasMolAccess(access, 1, 'Другой')).toBe(false);
  });

  it('склад без завода и завод без склада не совпадают', () => {
    expect(hasMolAccess(access, 1, '')).toBe(false);
    expect(hasMolAccess(access, null, 'Основной')).toBe(false);
    expect(hasMolAccess(access, undefined, 'Основной')).toBe(false);
  });

  it('завод сравнивается по значению, а не по типу', () => {
    // zavod приходит из базы то числом, то строкой — сравнение не должно зависеть от этого
    expect(hasMolAccess([{ zavod: '1', sklad: 'Основной' }], 1, 'Основной')).toBe(true);
    expect(hasMolAccess([{ zavod: 1, sklad: 'Основной' }], '1', 'Основной')).toBe(true);
  });

  it('пустой список доступов — доступа нет', () => {
    expect(hasMolAccess([], 1, 'Основной')).toBe(false);
  });

  it('склад сравнивается точно, регистр имеет значение', () => {
    expect(hasMolAccess(access, 1, 'основной')).toBe(false);
  });
});
