import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { LogsService } from '../../logs/logs.service';

/**
 * Сервис для физического хранения и управления файлами вложений на диске.
 * 
 * ## Назначение
 * Отвечает за файловые операции с email-вложениями:
 * сохранение, удаление, проверка существования, получение пути.
 * 
 * ## Хранение
 * Все файлы сохраняются в директорию, указанную в конфиге
 * `email.attachments.path` (по умолчанию `../email-attachments`).
 * При старте сервис проверяет существование директории и создаёт её,
 * если она отсутствует.
 * 
 * ## Именование файлов
 * При сохранении генерируется уникальное имя:
 * `{prefix}_{timestamp}_{random}{ext}`
 * Например: `osv_1715700000000_1234.xlsx`
 * 
 * ## Использование
 * Вызывается из EmailProcessor (сохранение) и EmailAttachmentsService (удаление).
 */
@Injectable()
export class EmailStorageService {
  private readonly logger = new Logger(EmailStorageService.name);

  /**
   * Абсолютный путь к директории для хранения вложений.
   * Вычисляется при создании сервиса из конфига.
   */
  private readonly attachmentsDir: string;

  /**
   * Создаёт сервис, вычисляет путь к директории вложений
   * и гарантирует её существование.
   * 
   * @param configService - сервис конфигурации NestJS
   * @param logsService - сервис логирования
   */
  constructor(
    private configService: ConfigService,
    private logsService: LogsService,
  ) {
    // Вычисляем абсолютный путь: текущая директория + путь из конфига
    this.attachmentsDir = path.resolve(
      process.cwd(),
      this.configService.get('email.attachments.path', '../email-attachments')
    );

    // Гарантируем, что директория существует
    this.ensureDirectoryExists();
  }

  /**
   * Сохранить файл на диск с уникальным именем.
   * 
   * ## Процесс
   * 1. Генерирует уникальное имя файла (чтобы избежать конфликтов)
   * 2. Записывает содержимое (Buffer) на диск
   * 3. Логирует результат
   * 
   * @param filename - оригинальное имя файла (для извлечения расширения)
   * @param content - содержимое файла в виде Buffer
   * @param prefix - префикс для имени файла (по умолчанию 'osv')
   * @returns Объект с полным путём к файлу и уникальным именем
   * 
   * @example
   * const { filePath, uniqueFilename } = await storage.saveFile(
   *   'Ведомость.xlsx',
   *   buffer,
   *   'osv'
   * );
   * // uniqueFilename = 'osv_1715700000000_1234.xlsx'
   * // filePath = '/app/email-attachments/osv_1715700000000_1234.xlsx'
   */
  async saveFile(
    filename: string,
    content: Buffer,
    prefix: string = 'osv'
  ): Promise<{ filePath: string; uniqueFilename: string }> {
    // Генерируем уникальное имя, сохраняя расширение исходного файла
    const uniqueFilename = this.generateUniqueFilename(filename, prefix);
    const filePath = path.join(this.attachmentsDir, uniqueFilename);

    // Записываем содержимое на диск
    await fs.promises.writeFile(filePath, content);

    this.logger.log(`Файл сохранён: ${uniqueFilename}`);

    this.logsService.log('backend', null, {
      action: 'file_saved',
      filename: uniqueFilename,
      originalName: filename,
      size: content.length
    });

    return { filePath, uniqueFilename };
  }

  /**
   * Удалить файл с диска.
   * 
   * ## Поведение
   * - Если файл существует — удаляет его.
   * - Если файл не найден (ENOENT) — логирует предупреждение, но не выбрасывает ошибку.
   *   Это нормально: файл мог быть удалён ранее или не существовать вовсе.
   * - При других ошибках — пробрасывает исключение выше.
   * 
   * @param filename - имя файла (уникальное, сгенерированное при сохранении)
   * 
   * @example
   * await storage.deleteFile('osv_1715700000000_1234.xlsx');
   */
  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.attachmentsDir, filename);

    try {
      // Проверяем, что файл существует
      await fs.promises.access(filePath);

      // Удаляем файл
      await fs.promises.unlink(filePath);

      this.logger.log(`Файл удалён: ${filename}`);

      this.logsService.log('backend', null, {
        action: 'file_deleted',
        filename: filename
      });
    } catch (error) {
      // ENOENT — файл не найден, это не критично
      if (error.code === 'ENOENT') {
        this.logger.warn(`Файл не найден (возможно, уже удалён): ${filename}`);
      } else {
        // Другие ошибки (например, нет прав) — пробрасываем
        throw error;
      }
    }
  }

  /**
   * Проверить существование файла на диске.
   * 
   * @param filename - имя файла
   * @returns `true` если файл существует, `false` если нет
   * 
   * @example
   * const exists = await storage.fileExists('osv_1715700000000_1234.xlsx');
   */
  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.attachmentsDir, filename);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить полный абсолютный путь к файлу.
   * 
   * ## Примечание
   * Метод не проверяет существование файла — только формирует путь.
   * Для проверки существования используйте fileExists().
   * 
   * @param filename - имя файла
   * @returns Абсолютный путь к файлу
   * 
   * @example
   * const fullPath = storage.getFilePath('osv_1715700000000_1234.xlsx');
   * // '/app/email-attachments/osv_1715700000000_1234.xlsx'
   */
  getFilePath(filename: string): string {
    return path.join(this.attachmentsDir, filename);
  }

  /**
   * Сгенерировать уникальное имя файла.
   * 
   * ## Формат имени
   * `{prefix}_{timestamp}_{random}{ext}`
   * 
   * Где:
   * - `prefix` — строковый префикс (например, 'osv')
   * - `timestamp` — текущее время в миллисекундах (Date.now())
   * - `random` — случайное число от 0 до 9999
   * - `ext` — расширение исходного файла
   * 
   * ## Зачем
   * Уникальное имя гарантирует, что файлы с одинаковыми исходными именами
   * не перезапишут друг друга.
   * 
   * @param originalName - исходное имя файла (для извлечения расширения)
   * @param prefix - префикс (например, 'osv')
   * @returns Уникальное имя файла с расширением
   * 
   * @example
   * // 'osv_1715700000000_1234.xlsx'
   * generateUniqueFilename('Ведомость.xlsx', 'osv')
   */
  private generateUniqueFilename(originalName: string, prefix: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}${ext}`;
  }

  /**
   * Убедиться, что директория для вложений существует.
   * 
   * Вызывается однократно при создании сервиса.
   * Если директория не существует — создаёт её рекурсивно
   * (включая все промежуточные директории).
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true });
      this.logger.log(`Создана директория для вложений: ${this.attachmentsDir}`);
    }
  }
}