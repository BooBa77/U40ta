import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailCodeService } from './email-code.service';

/**
 * Тесты жизненного цикла кода подтверждения.
 *
 * Коды живут в памяти, у них есть срок (5 минут), и на один email допускается
 * только один активный код. Всё это — правила, которые легко нарушить при
 * правке, а последствия видит пользователь: «код не пришёл», «код не подошёл».
 */
describe('EmailCodeService', () => {
  let service: EmailCodeService;

  beforeEach(() => {
    // Логгер молчит: сервис пишет на каждое действие, иначе вывод тестов тонет.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = new EmailCodeService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('выдаёт четырёхзначный код и принимает его', () => {
    const code = service.createCode('user@example.ru');

    expect(code).toMatch(/^\d{4}$/);
    expect(service.verifyCode('user@example.ru', code)).toBe(true);
  });

  it('нормализует email: регистр и пробелы не важны', () => {
    const code = service.createCode('  USER@Example.RU  ');

    expect(service.verifyCode('user@example.ru', code)).toBe(true);
  });

  it('код одноразовый: после успешной проверки он больше не подходит', () => {
    const code = service.createCode('user@example.ru');

    expect(service.verifyCode('user@example.ru', code)).toBe(true);
    expect(service.verifyCode('user@example.ru', code)).toBe(false);
  });

  it('пока активен один код, второй запросить нельзя', () => {
    service.createCode('user@example.ru');

    expect(() => service.createCode('user@example.ru')).toThrow();
  });

  it('через 5 минут код не принимается, и можно запросить новый', () => {
    const first = service.createCode('user@example.ru');

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(service.verifyCode('user@example.ru', first)).toBe(false);
    expect(() => service.createCode('user@example.ru')).not.toThrow();
  });

  it('неверный код не принимается и не расходует правильный', () => {
    const code = service.createCode('user@example.ru');

    expect(service.verifyCode('user@example.ru', '0000')).toBe(false);
    expect(service.verifyCode('user@example.ru', code)).toBe(true);
  });

  it('hasActiveCode учитывает срок жизни', () => {
    service.createCode('user@example.ru');
    expect(service.hasActiveCode('user@example.ru')).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(service.hasActiveCode('user@example.ru')).toBe(false);
  });

  it('getRemainingSeconds считает остаток и обнуляется после истечения', () => {
    service.createCode('user@example.ru');
    expect(service.getRemainingSeconds('user@example.ru')).toBe(300);

    vi.advanceTimersByTime(1000);
    expect(service.getRemainingSeconds('user@example.ru')).toBe(299);

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(service.getRemainingSeconds('user@example.ru')).toBe(0);
  });

  it('deleteCode убирает код досрочно', () => {
    const code = service.createCode('user@example.ru');

    service.deleteCode('user@example.ru');

    expect(service.hasActiveCode('user@example.ru')).toBe(false);
    expect(service.verifyCode('user@example.ru', code)).toBe(false);
  });

  it('коды разных адресов не мешают друг другу', () => {
    const first = service.createCode('one@example.ru');
    const second = service.createCode('two@example.ru');

    expect(service.getRemainingSeconds('one@example.ru')).toBeGreaterThan(0);
    expect(service.getRemainingSeconds('two@example.ru')).toBeGreaterThan(0);
    expect(service.verifyCode('one@example.ru', second)).toBe(false);
    expect(service.verifyCode('one@example.ru', first)).toBe(true);
    expect(service.hasActiveCode('two@example.ru')).toBe(true);
  });
});
