import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { OnEvent } from '@nestjs/event-emitter';
import { Statement } from '../entities/statement.entity';

/**
 * Интерфейс события statement.file.received.
 */
interface StatementFileReceivedEvent {
  buffer: Buffer;      // Содержимое Excel-файла
  filename: string;    // Оригинальное имя файла
  userId: number;      // ID пользователя-владельца (МОЛ)
  docType: string;     // Тип документа: 'ОСВ' или 'ОС'
  description: string; // Описание ведомости, например "ОСВ s010,s017"
}

/**
 * Сервис парсинга Excel-файлов ведомостей МОЛ.
 * 
 * ## Назначение
 * Слушает событие `statement.file.received` от EmailModule,
 * парсит строки Excel и сохраняет их в таблицу statements.
 * 
 * ## Процесс
 * 1. Получает Buffer с Excel-файлом из события
 * 2. В зависимости от docType парсит колонки
 * 3. Создаёт по записи Statement на каждую строку
 * 4. Сохраняет в БД
 * 
 * ## Фильтрация по единицам измерения (только ОСВ)
 * Строки с единицей измерения, отличной от «ШТ» и «КМП» (например «КГ», «Л»),
 * игнорируются и не создают записей в базе.
 * 
 * ## Отличия от старого StatementParserService
 * - Не привязан к email_attachments
 * - Не имеет транзакций и флагов in_process
 * - Не читает файлы с диска — работает с Buffer
 * - Не отправляет SSE-уведомления
 */
@Injectable()
export class StatementParser {
  private readonly logger = new Logger(StatementParser.name);

  /**
   * Словарь допустимых единиц измерения для ОСВ.
   * Строки с другими единицами игнорируются при парсинге.
   */
  private readonly allowedUnits = new Set(['ШТ', 'КМП']);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepo: Repository<Statement>,
  ) {}

  /**
   * Обработчик события statement.file.received.
   * Вызывается когда EmailProcessor эмитит событие для обычной ведомости МОЛ.
   * 
   * @param payload - данные файла (buffer, filename, userId, docType, description)
   */
  @OnEvent('statement.file.received')
  async handleStatementFile(payload: StatementFileReceivedEvent): Promise<void> {
    const { buffer, filename, userId, docType, description } = payload;

    this.logger.log(`Парсинг ведомости МОЛ: ${filename}, тип: ${docType}, описание: ${description}`);

    try {
      // Парсим Excel из Buffer
      const rows = this.parseExcel(buffer, docType);

      if (rows.length === 0) {
        this.logger.warn(`Файл ${filename} не содержит данных для парсинга`);
        return;
      }

      // Получаем текущую дату для всех строк одного файла
      const receivedAt = new Date();

      // Создаём сущности
      const statements = rows.map(row => {
        const statement = new Statement();
        statement.userId = userId;
        statement.receivedAt = receivedAt;
        statement.docType = docType;
        statement.description = description;
        statement.zavod = row.zavod;
        statement.sklad = row.sklad;
        statement.invNumber = row.invNumber;
        statement.partyNumber = row.partyNumber;
        statement.buhName = row.buhName;
        statement.isActual = true;
        return statement;
      });

      // Сохраняем в БД
      await this.statementRepo.save(statements);

      this.logger.log(
        `Сохранено ${statements.length} строк в statements: ${filename}`
      );

    } catch (error) {
      this.logger.error(`Ошибка парсинга ведомости ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Парсит Excel из Buffer в зависимости от типа документа.
   * 
   * @param buffer - содержимое Excel-файла
   * @param docType - тип документа ('ОСВ' или 'ОС')
   * @returns Массив строк для сохранения
   */
  private parseExcel(
    buffer: Buffer,
    docType: string
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string; buhName: string }> {
    // Читаем Excel из Buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (docType === 'ОСВ') {
      return this.parseOsvRows(data);
    } else if (docType === 'ОС') {
      return this.parseOsRows(data);
    }

    this.logger.warn(`Неизвестный тип документа: ${docType}`);
    return [];
  }

  /**
   * Парсит строки ОСВ (оборотно-сальдовая ведомость).
   * 
   * Колонки: Завод, Склад, КрТекстМатериала, Материал, Партия, Запас на конец периода, Единица.
   * Каждая строка Excel создаёт столько записей в statements,
   * сколько указано в колонке "Запас на конец периода".
   * 
   * Строки с единицей измерения, отличной от «ШТ» и «КМП»,
   * игнорируются и не создают записей.
   * 
   * @param data - массив строк Excel
   * @returns Массив объектов для сохранения в БД
   */
  private parseOsvRows(
    data: any[]
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string; buhName: string }> {
    const rows: Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string; buhName: string }> = [];

    for (const row of data) {
      // Извлекаем zavod
      let zavod = 0;
      const rowZavod = row['Завод'];
      if (typeof rowZavod === 'number') {
        zavod = rowZavod;
      } else if (typeof rowZavod === 'string') {
        const parsed = parseInt(rowZavod.trim(), 10);
        zavod = isNaN(parsed) ? 0 : parsed;
      }

      // Извлекаем sklad
      const sklad = row['Склад']?.toString()?.trim() || '';

      // Извлекаем buhName (КрТекстМатериала или Материал)
      const buhName = row['КрТекстМатериала']?.toString()?.trim() ||
        row['Материал']?.toString()?.trim() || '';

      // Извлекаем invNumber (Материал)
      const invNumber = row['Материал']?.toString()?.trim() || '';

      // Пропускаем строки с пустым инвентарным номером (сводные строки)
      if (!invNumber) {
        continue;
      }

      // Извлекаем partyNumber
      const partyNumber = row['Партия']?.toString()?.trim() || '-';

      // Пропускаем строки с пустым складом
      if (!sklad) {
        continue;
      }

      // Проверяем единицу измерения — только «ШТ» и «КМП» допустимы
      const unit = row['Единица']?.toString()?.trim() || '';
      if (!this.allowedUnits.has(unit)) {
        this.logger.debug(
          `Строка пропущена: единица измерения "${unit}" не входит в допустимые ` +
          `(${[...this.allowedUnits].join(', ')}), материал="${invNumber}"`
        );
        continue;
      }

      // Получаем количество из колонки "Запас на конец периода"
      let quantity = 1;
      const quantityValue = row['Запас на конец периода'];
      if (quantityValue !== undefined && quantityValue !== null) {
        const num = Number(quantityValue);
        if (!isNaN(num) && num > 0) {
          quantity = Math.floor(num);
        }
      }

      // Создаём нужное количество записей
      for (let i = 0; i < quantity; i++) {
        rows.push({ zavod, sklad, invNumber, partyNumber, buhName });
      }
    }

    return rows;
  }

  /**
   * Парсит строки ОС (основные средства).
   * 
   * Колонки: МОЛ, Название, Инвентарный номер.
   * Каждая строка с непустым Инвентарным номером создаёт запись.
   * zavod всегда 0, partyNumber всегда '-'.
   * 
   * @param data - массив строк Excel
   * @returns Массив объектов для сохранения в БД
   */
  private parseOsRows(
    data: any[]
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string; buhName: string }> {
    const rows: Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string; buhName: string }> = [];

    for (const row of data) {
      const buhName = row['Название']?.toString()?.trim() || '';
      const invNumber = row['Инвентарный номер']?.toString()?.trim() || '';
      const sklad = row['МОЛ']?.toString()?.trim() || '';

      // Пропускаем строки с пустыми обязательными полями
      if (!buhName || !invNumber || !sklad) {
        continue;
      }

      rows.push({
        zavod: 0,
        sklad,
        invNumber,
        partyNumber: '-',
        buhName
      });
    }

    return rows;
  }
}