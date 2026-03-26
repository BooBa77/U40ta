import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './logs.entity';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectRepository(Log)
    private logsRepository: Repository<Log>,
  ) {}

  /**
   * Запись лога (fire-and-forget)
   * @param source - источник: 'backend' или 'frontend'
   * @param userId - id пользователя (может быть null)
   * @param content - любые данные в формате JSON
   */
  log(source: string, userId: number | null, content: any): void {
    // Не ждем результат, чтобы не блокировать приложение
    this.logsRepository
      .insert({
        source,
        user_id: userId,
        content,
      })
      .catch((err) => {
        // Тихий fallback — логируем в консоль, но не ломаем пользователю работу
        this.logger.error(`Failed to write log to database: ${err.message}`);
        this.logger.debug('Lost log content:', JSON.stringify({ source, userId, content }));
      });
  }
}