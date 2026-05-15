import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { OnEvent } from '@nestjs/event-emitter';
import { InventoryStatement } from '../entities/inventory-statement.entity';
import { AppEventsService } from '../../app-events/app-events.service';
import { LogsService } from '../../logs/logs.service';

/**
 * Интерфейс события inventory.file.received.
 */
interface InventoryFileReceivedEvent {
  buffer: Buffer;      // Содержимое Excel-файла
  filename: string;    // Оригинальное имя файла
  emailFrom: string;   // Email ревизора-отправителя
  docType: string;     // Тип документа: 'ОСВ' или 'ОС'
}

/**
 * Сервис парсинга инвентаризационных Excel-файлов.
 * 
 * ## Назначение
 * Слушает событие `inventory.file.received` от EmailModule,
 * парсит строки Excel и сохраняет их в таблицу inventory_statements.
 * 
 * ## Процесс
 * 1. Получает Buffer с Excel-файлом из события
 * 2. В зависимости от docType парсит колонки
 * 3. Создаёт по записи InventoryStatement на каждую строку
 * 4. Сохраняет в БД
 * 5. Эмитит SSE-событие inventory-statement-loaded
 * 
 * ## Отличия от StatementParserService (МОЛ)
 * - Не привязан к email_attachments
 * - Не имеет транзакций и флагов in_process
 */
@Injectable()
export class InventoryStatementParser {
  private readonly logger = new Logger(InventoryStatementParser.name);

  /**
   * Обязательные колонки для ОСВ.
   */
  private readonly osvColumns = [
    'Завод',
    'Склад',
    'КрТекстМатериала',
    'Материал',
    'Партия',
    'Запас на конец периода'
  ];

  /**
   * Обязательные колонки для ОС.
   */
  private readonly osColumns = [
    'Основное средство',
    'Название',
    'Инвентарный номер',
    'МОЛ'
  ];

  constructor(
    @InjectRepository(InventoryStatement)
    private readonly inventoryStatementRepo: Repository<InventoryStatement>,
    private readonly appEventsService: AppEventsService,
    private readonly logsService: LogsService,
  ) {}

  /**
   * Обработчик события inventory.file.received.
   * Вызывается когда EmailProcessor эмитит событие для инвентаризационного файла.
   * 
   * @param payload - данные файла (buffer, filename, emailFrom, docType)
   */
  @OnEvent('inventory.file.received')
  async handleInventoryFile(payload: InventoryFileReceivedEvent): Promise<void> {
    const { buffer, filename, emailFrom, docType } = payload;

    this.logger.log(`Парсинг инвентаризационного файла: ${filename}, тип: ${docType}`);

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
        const statement = new InventoryStatement();
        statement.emailFrom = emailFrom;
        statement.receivedAt = receivedAt;
        statement.docType = docType;
        statement.zavod = row.zavod;
        statement.sklad = row.sklad;
        statement.invNumber = row.invNumber;
        statement.partyNumber = row.partyNumber;
        statement.buhName = row.buhName;
        return statement;
      });

      // Сохраняем в БД
      await this.inventoryStatementRepo.save(statements);

      this.logger.log(
        `Сохранено ${statements.length} строк в inventory_statements: ${filename}`
      );

      this.logsService.log('backend', null, {
        action: 'inventory_parsed',
        filename,
        emailFrom,
        docType,
        rowsCount: statements.length
      });

      // SSE-уведомление с ключом email — только для этого ревизора
      this.appEventsService.notifyInventoryStatementLoaded(emailFrom);

    } catch (error) {
      this.logger.error(`Ошибка парсинга инвентаризационного файла ${filename}:`, error);

      this.logsService.log('backend', null, {
        action: 'inventory_parse_error',
        filename,
        emailFrom,
        error: error.message
      });
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
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string | null; buhName: string }> {
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
   * Колонки: Завод, Склад, КрТекстМатериала, Материал, Партия, Запас на конец периода.
   * Каждая строка с непустым Материалом (инв.номером) создаёт запись.
   * Количество из колонки "Запас на конец периода" игнорируется —
   * каждая строка Excel = одна строка в inventory_statements.
   */
  private parseOsvRows(
    data: any[]
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string | null; buhName: string }> {
    const rows: Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string | null; buhName: string }> = [];

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
      const partyNumber = row['Партия']?.toString()?.trim() || null;

      // Пропускаем строки с пустым складом
      if (!sklad) {
        continue;
      }

      rows.push({ zavod, sklad, invNumber, partyNumber, buhName });
    }

    return rows;
  }

  /**
   * Парсит строки ОС (основные средства).
   * 
   * Колонки: Основное средство, Название, Инвентарный номер, МОЛ.
   * Каждая строка с непустым Инвентарным номером создаёт запись.
   * zavod всегда 0, partyNumber всегда null.
   */
  private parseOsRows(
    data: any[]
  ): Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string | null; buhName: string }> {
    const rows: Array<{ zavod: number; sklad: string; invNumber: string; partyNumber: string | null; buhName: string }> = [];

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
        partyNumber: null,
        buhName
      });
    }

    return rows;
  }
}