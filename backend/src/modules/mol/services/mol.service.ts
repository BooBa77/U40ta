import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { InventoryObject } from '../../objects/entities/object.entity';
import { Log } from '../../logs/logs.entity';
import { SmtpService } from '../../email/services/smtp.service';
import { UsersService } from '../../users/users.service';
import { errorMessage, errorStack } from '../../../common/utils/error';

@Injectable()
export class MolService {
  private readonly logger = new Logger(MolService.name);

  constructor(
    @InjectRepository(InventoryObject)
    private readonly objectRepository: Repository<InventoryObject>,
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    private readonly smtpService: SmtpService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Экспорт доступных объектов МОЛа в Excel и отправка на почту
   * @param userId - ID пользователя
   */
  async exportExcel(userId: number): Promise<{ success: boolean; message: string }> {
    try {
        // 1. Получаем пользователя для email
        const user = await this.usersService.findById(userId);
        if (!user) {
        throw new BadRequestException('Пользователь не найден');
        }

        if (!user.eMail) {
        throw new BadRequestException('У пользователя не указан email');
        }

        // 2. Получаем список складов пользователя через UsersService
        const sklads = await this.usersService.getMolAccess(userId);
        if (!sklads || sklads.length === 0) {
        throw new BadRequestException('У пользователя нет доступных складов');
        }

        // 3. Собираем объекты по всем складам
        const objects = await this.getObjectsBySklads(sklads);

        // 4. Собираем ID объектов
        const objectIds = objects.map(obj => obj.id);

        // 5. Собираем логи по этим объектам с обогащением пользователями
        const logs = await this.getLogsWithUsers(objectIds);

        // 6. Формируем Excel
        const buffer = this.createExcel(objects, logs);

        // 7. Формируем имя файла
        const now = new Date();
        const timestamp =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
        const filename = `Объекты_МОЛ_${timestamp}.xlsx`;

        // 8. Отправляем на почту через SmtpService
        const result = await this.smtpService.sendEmail(
        'u40ta@mail.ru', // ХАРДКОД из-за проблем с корпоративным МО, должно быть: user.eMail,
        `Для: ${user.eMail} | Выгрузка доступных объектов МОЛ`,
        `Во вложении таблица с доступными Вам объектами и историей их изменений.\n\n` +
        `Сформировано: ${now.toLocaleString('ru-RU')}\n` +
        `Объектов: ${objects.length}\n` +
        `Событий: ${logs.length}`,
        [
            {
            filename,
            content: buffer,
            },
        ],
        );

        return {
        success: result.success,
        message: result.success ? `Таблица экспортирована на ${user.eMail}` : 'Ошибка при отправке письма',
        };
    } catch (error) {
        this.logger.error(`[MolService] Ошибка экспорта: ${errorMessage(error)}`, errorStack(error));
        throw new InternalServerErrorException(errorMessage(error) || 'Не удалось выгрузить данные');
    }
  }

  /**
   * Объекты всех складов, доступных пользователю.
   *
   * Используется мини-таблицей на главной: она показывает объекты всех складов
   * МОЛа одним списком, а не отдельным запросом на каждый склад (как модалка
   * поиска в разделе МОЛ). Склады берутся из `mol_access`, поэтому основные
   * средства попадают сюда автоматически — у них `zavod = 0`.
   *
   * @param userId - ID пользователя
   */
  async getObjectsForUser(userId: number): Promise<InventoryObject[]> {
    const molAccess = await this.usersService.getMolAccess(userId);
    this.logger.log(
      `Объекты для мини-таблицы: ${molAccess.length} складов у пользователя ${userId}`,
    );
    return this.getObjectsBySklads(molAccess);
  }

  /**
   * Получает объекты по списку складов
   */
  private async getObjectsBySklads(
    sklads: { zavod: number; sklad: string }[]
  ): Promise<InventoryObject[]> {
    if (sklads.length === 0) {
      return [];
    }

    // Условия собираются параметрами, а не подстановкой значений в строку.
    // Значения приходят из базы, поэтому инъекции здесь не было, но
    // конкатенация в SQL становится опасной ровно в тот момент, когда источник
    // данных меняется, — а заметить это потом нечем.
    const query = this.objectRepository
      .createQueryBuilder('obj')
      .orderBy('obj.zavod', 'ASC')
      .addOrderBy('obj.sklad', 'ASC')
      .addOrderBy('obj.invNumber', 'ASC');

    sklads.forEach((s, index) => {
      const condition = `(obj.zavod = :zavod_${index} AND obj.sklad = :sklad_${index})`;

      if (index === 0) {
        query.where(condition);
      } else {
        query.orWhere(condition);
      }

      query.setParameter(`zavod_${index}`, s.zavod);
      query.setParameter(`sklad_${index}`, s.sklad);
    });

    return query.getMany();
  }

  /**
   * Получает логи по списку ID объектов с обогащением пользователями
   */
  private async getLogsWithUsers(objectIds: number[]): Promise<any[]> {
    if (objectIds.length === 0) {
      return [];
    }

    // Получаем логи
    const logs = await this.logRepository
      .createQueryBuilder('log')
      .where('log.source = :source', { source: 'object-history' })
      .andWhere(`(log.content->>'object_id')::int IN (:...ids)`, { ids: objectIds })
      .orderBy('log.time', 'ASC')
      .getMany();

    if (logs.length === 0) {
      return [];
    }

    // Получаем всех пользователей
    const users = await this.usersService.findAll();

    const userMap = new Map(users.map(u => [u.id, u]));

    // Обогащаем логи данными пользователей
    const enrichedLogs = logs.map(log => {
      const userId = Number(log.userId);
      const user = userId ? userMap.get(userId) : null;
      const content = log.content || {};
      
      return {
        ...log,
        objectId: content.object_id,
        user: user,
        eventType: content.event_type,
        storyLine: content.story_line
      };
    });

    return enrichedLogs;
  }


  /**
   * Создает Excel с двумя листами
   */
  private createExcel(objects: InventoryObject[], logs: any[]): Buffer {
    const workbook = XLSX.utils.book_new();

    // --- Лист 1: Объекты ---
    const objectsData = objects.map(obj => ({
      'id': obj.id,
      'Завод': obj.zavod,
      'Склад': obj.sklad,
      'Инв. номер': obj.invNumber,
      'Партия': obj.partyNumber || '-',
      'Наименование': obj.buhName,
      'S/N': obj.sn || '-',
      'Территория': obj.placeTer || '-',
      'Позиция': obj.placePos || '-',
      'Кабинет': obj.placeCab || '-',
      'Пользователь': obj.placeUser || '-',
      'Проверен': obj.checkedAt ? new Date(obj.checkedAt).toLocaleDateString('ru-RU') : '-',
      'Списан': obj.isWrittenOff ? 'Да' : 'Нет'
    }));

    const objectsSheet = XLSX.utils.json_to_sheet(objectsData);
    XLSX.utils.book_append_sheet(workbook, objectsSheet, 'Объекты');

    // Автоширина для объектов
    // `as const` — чтобы `key` был объединением литералов, а не `string`:
    // иначе обращение `row[key]` упирается в строгую проверку индексов (TS7053).
    const objectKeys = ['id', 'Завод', 'Склад', 'Инв. номер', 'Партия', 'Наименование', 'S/N', 'Территория', 'Позиция', 'Кабинет', 'Пользователь', 'Проверен', 'Списан'] as const;
    const objectCols = objectKeys.map((key) => {
      let maxLen = key.length;
      for (const row of objectsData) {
        const val = row[key] !== undefined ? String(row[key]) : '';
        const len = val.length;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 2, 60) };
    });
    objectsSheet['!cols'] = objectCols;

    // --- Лист 2: Логи ---
    const logsData = logs.map(log => {
      const user = log.user || null;
      
      return {
        'id объекта': log.objectId || '-',
        'Дата': log.time ? new Date(log.time).toLocaleString('ru-RU') : '-',
        'Сотрудник': user ? user.abr : '-',
        'Событие': log.storyLine || '-'
      };
    });

    const logsSheet = XLSX.utils.json_to_sheet(logsData);
    XLSX.utils.book_append_sheet(workbook, logsSheet, 'Логи');

    // Автоширина для логов
    // `as const` — по той же причине, что и у `objectKeys` выше.
    const logKeys = ['id объекта', 'Дата', 'Сотрудник', 'Событие'] as const;
    const logCols = logKeys.map((key) => {
      let maxLen = key.length;
      for (const row of logsData) {
        const val = row[key] !== undefined ? String(row[key]) : '';
        const len = val.length;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 2, 80) };
    });
    logsSheet['!cols'] = logCols;

    // Сохраняем в Buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}