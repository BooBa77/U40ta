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
   * @param source - источник: 'backend', 'frontend' для системных или 'object-history', 'qr-code-history' для бизнесс-процессов
   * @param userId - id пользователя (может быть null)
   * @param content - любые данные в формате JSON
   */
  log(source: string, userId: number | null, content: any, time?: Date): void {
    // Не ждем результат, чтобы не блокировать приложение
    this.logsRepository
      .insert({
        source,
        userId: userId,
        content,
        time: time ?? undefined,
      })
      .catch((err) => {
        this.logger.error(`Failed to write log to database: ${err.message}`);
        this.logger.debug('Lost log content:', JSON.stringify({ source, userId, content }));
      });
  }

  /**
   * Получает историю изменений объекта с информацией о пользователях.
   * 
   * @param objectId - ID объекта
   * @returns массив записей истории с полями:
   *   - id — ID записи лога
   *   - time — дата/время события
   *   - eventType — тип события (created, place_changed, sn_changed, comment, checked)
   *   - storyLine — человекочитаемое описание
   *   - userAbr — аббревиатура пользователя (3 буквы) или null
   */
  async getObjectHistory(objectId: number): Promise<Array<{
    id: number;
    time: Date;
    eventType: string;
    storyLine: string;
    userAbr: string | null;
  }>> {
    // Получаем логи по объекту
    const logs = await this.logsRepository
      .createQueryBuilder('log')
      .where('log.source = :source', { source: 'object-history' })
      .andWhere(`(log.content->>'object_id')::int = :objectId`, { objectId })
      .orderBy('log.time', 'ASC')
      .getMany();

    if (logs.length === 0) {
      return [];
    }

    // Собираем уникальные userId
    const userIds = [...new Set(
      logs
        .map(log => Number(log.userId))
        .filter(id => id !== null && !isNaN(id))
    )];

    // Получаем пользователей
    let userMap = new Map<number, { abr: string }>();
    
    if (userIds.length > 0) {
      // Используем queryBuilder вместо usersService для избежания циклических зависимостей
      const users = await this.logsRepository.manager
        .createQueryBuilder()
        .select(['id', 'abr'])
        .from('users', 'u')
        .where('u.id IN (:...ids)', { ids: userIds })
        .getRawMany();
      
      userMap = new Map(users.map((u: any) => [Number(u.id), { abr: u.abr }]));
    }

    // Обогащаем логи
    return logs.map(log => {
      const content = log.content || {};
      const userId = Number(log.userId);
      const user = userId ? userMap.get(userId) : null;

      return {
        id: log.id,
        time: log.time,
        eventType: content.event_type || 'unknown',
        storyLine: content.story_line || '',
        userAbr: user?.abr || null,
      };
    });
  }
}