import { Injectable, Logger } from '@nestjs/common';

/**
 * Данные о коде подтверждения для одного email
 */
interface CodeData {
  /** Четырехзначный код подтверждения */
  code: string;
  /** Время истечения кода (timestamp) */
  expiresAt: number;
}

/**
 * Сервис для генерации и хранения кодов подтверждения email.
 * 
 ## Назначение
 * Хранит коды в оперативной памяти (Map).
 * При перезапуске сервера все коды сбрасываются.
 * 
 * ## Формат кода
 * Четырехзначное число (0000-9999).
 * 
 * ## Время жизни
 * 5 минут (300 секунд).
 * 
 * ## Ограничения
 * Один email может иметь только один активный код.
 * Новый код можно запросить только после истечения старого.
 */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);
  
  /** Хранилище кодов: email -> данные кода */
  private readonly codes = new Map<string, CodeData>();
  
  /** Время жизни кода в миллисекундах (5 минут) */
  private readonly CODE_TTL_MS = 5 * 60 * 1000;

  /**
   * Генерация случайного четырехзначного кода.
   * 
   * @returns строка из 4 цифр (например, "1234")
   */
  private generateCode(): string {
    const code = Math.floor(1000 + Math.random() * 9000);
    return code.toString();
  }

  /**
   * Создать новый код для email.
   * 
   * @param email - email пользователя
   * @returns сгенерированный четырехзначный код
   * 
   * @throws {Error} если для этого email уже есть активный код
   */
  createCode(email: string): string {
    // Нормализуем email (приводим к нижнему регистру)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Проверяем, нет ли уже активного кода
    const existing = this.codes.get(normalizedEmail);
    if (existing && existing.expiresAt > Date.now()) {
      const remaining = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      this.logger.warn(
        `Попытка создать новый код для ${normalizedEmail}, активный код истечет через ${remaining}с`
      );
      throw new Error(`Код уже отправлен. Подождите ${Math.ceil(remaining / 60)} минут(ы)`);
    }

    // Генерируем новый код
    const code = this.generateCode();
    const expiresAt = Date.now() + this.CODE_TTL_MS;
    
    this.codes.set(normalizedEmail, { code, expiresAt });
    
    this.logger.log(`Создан код для ${normalizedEmail}: ${code}, истекает через 5 минут`);
    
    return code;
  }

  /**
   * Проверить код для email.
   * 
   * @param email - email пользователя
   * @param code - код для проверки
   * @returns true если код верный и не истек, иначе false
   */
  verifyCode(email: string, code: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    
    const data = this.codes.get(normalizedEmail);
    
    if (!data) {
      this.logger.warn(`Проверка кода для ${normalizedEmail}: код не найден`);
      return false;
    }
    
    // Проверяем срок действия
    if (data.expiresAt < Date.now()) {
      this.logger.warn(`Проверка кода для ${normalizedEmail}: код истек`);
      // Удаляем истекший код
      this.codes.delete(normalizedEmail);
      return false;
    }
    
    // Проверяем сам код
    const isValid = data.code === code;
    
    if (isValid) {
      this.logger.log(`Код для ${normalizedEmail} подтвержден успешно`);
      // Удаляем использованный код
      this.codes.delete(normalizedEmail);
    } else {
      this.logger.warn(`Неверный код для ${normalizedEmail}: введено ${code}, ожидалось ${data.code}`);
    }
    
    return isValid;
  }

  /**
   * Проверить, активен ли код для email.
   * 
   * @param email - email пользователя
   * @returns true если есть активный код
   */
  hasActiveCode(email: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    
    const data = this.codes.get(normalizedEmail);
    if (!data) {
      return false;
    }
    
    // Проверяем, не истек ли код
    if (data.expiresAt < Date.now()) {
      this.codes.delete(normalizedEmail);
      return false;
    }
    
    return true;
  }

  /**
   * Удалить код для email (принудительно).
   * 
   * @param email - email пользователя
   */
  deleteCode(email: string): void {
    const normalizedEmail = email.toLowerCase().trim();
    this.codes.delete(normalizedEmail);
    this.logger.log(`Код для ${normalizedEmail} удален`);
  }

  /**
   * Получить время до истечения кода в секундах.
   * 
   * @param email - email пользователя
   * @returns количество секунд до истечения, или 0 если кода нет
   */
  getRemainingSeconds(email: string): number {
    const normalizedEmail = email.toLowerCase().trim();
    
    const data = this.codes.get(normalizedEmail);
    if (!data) {
      return 0;
    }
    
    const remaining = Math.ceil((data.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }
}