import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { LogsService } from '../../logs/logs.service';

@Injectable()
export class EmailStorageService {
  private readonly logger = new Logger(EmailStorageService.name);
  private readonly attachmentsDir: string;

  constructor(
    private configService: ConfigService,
    private logsService: LogsService,
  ) {
    this.attachmentsDir = path.resolve(
      process.cwd(),
      this.configService.get('email.attachments.path', '../email-attachments')
    );
    this.ensureDirectoryExists();
  }

  /**
   * Сохранить файл на диск
   */
  async saveFile(
    filename: string,
    content: Buffer,
    prefix: string = 'osv'
  ): Promise<{ filePath: string; uniqueFilename: string }> {
    const uniqueFilename = this.generateUniqueFilename(filename, prefix);
    const filePath = path.join(this.attachmentsDir, uniqueFilename);
    
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
   * Удалить файл с диска
   */
  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.attachmentsDir, filename);
    
    try {
      await fs.promises.access(filePath);
      await fs.promises.unlink(filePath);
      this.logger.log(`Файл удалён: ${filename}`);
      this.logsService.log('backend', null, {
        action: 'file_deleted',
        filename: filename
      });      
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`Файл не найден: ${filename}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Проверить существование файла
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
   * Получить полный путь к файлу
   */
  getFilePath(filename: string): string {
    return path.join(this.attachmentsDir, filename);
  }

  /**
   * Сгенерировать уникальное имя файла
   */
  private generateUniqueFilename(originalName: string, prefix: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}${ext}`;
  }

  /**
   * Убедиться, что директория существует
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true });
      this.logger.log(`Создана директория: ${this.attachmentsDir}`);
    }
  }
}