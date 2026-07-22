import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { LogsService } from '../../logs/logs.service';

/**
 * Сервис анализа Excel-файлов, поступающих по электронной почте.
 * 
 * ## Назначение
 * Определяет тип документа (ОСВ или ОС) по заголовкам колонок, извлекает
 * информацию о складах из всех строк и формирует описание ведомости.
 * 
 * ## Поддерживаемые типы документов
 * - **ОСВ** (оборотно-сальдовая ведомость) — колонки: Завод, Склад, КрТекстМатериала,
 *   Материал, Партия, Запас на конец периода, Единица
 * - **ОС** (основные средства) — колонки: Название, Инвентарный номер, МОЛ
 * 
 * ## Результат анализа
 * Для валидного файла возвращает:
 * - `isValid: true`
 * - `docType` — тип документа ('ОСВ' или 'ОС')
 * - `description` — описание ведомости, например "ОСВ s010,s017" или "ОС s010"
 * 
 * ## Принцип работы
 * Принимает Buffer с содержимым Excel-файла, не зависит от файловой системы.
 * 
 * ## Использование
 * Вызывается из EmailProcessor.analyzeAttachment() для каждого вложения.
 */
@Injectable()
export class EmailFileAnalyzer {
  /**
   * Обязательные колонки для документа типа ОСВ (оборотно-сальдовая ведомость).
   * Файл считается ОСВ, если в первой строке присутствуют ВСЕ эти колонки.
   */
  private readonly osvColumns = [
    'Завод',
    'Склад',
    'КрТекстМатериала',
    'Материал',
    'Партия',
    'Запас на конец периода',
    'Единица'
  ];

  /**
   * Обязательные колонки для документа типа ОС (основные средства).
   * Файл считается ОС, если в первой строке присутствуют ВСЕ эти колонки.
   */
  private readonly osColumns = [
    'МОЛ',
    'Название',
    'Инвентарный номер'
  ];

  constructor(private readonly logsService: LogsService) {}

  /**
   * Проанализировать Excel-файл из Buffer.
   * 
   * ## Этапы анализа
   * 1. Чтение Excel из Buffer через библиотеку xlsx
   * 2. Проверка, что файл содержит хотя бы один лист
   * 3. Проверка, что файл не пустой (есть строки данных)
   * 4. Определение типа документа по колонкам первой строки
   * 5. Сбор уникальных складов из всех строк
   * 6. Формирование description
   * 
   * ## Результат
   * - Для валидного файла: `{ isValid: true, docType, description }`
   * - Для невалидного: `{ isValid: false, error }`
   * 
   * @param buffer - содержимое Excel-файла в виде Buffer
   * @returns Объект с результатом анализа
   */
  async analyzeExcel(buffer: Buffer): Promise<{
    isValid: boolean;
    docType?: string;
    description?: string;
    error?: string;
  }> {
    try {
      // ========== Этап 1: Чтение Excel из Buffer ==========
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // ========== Этап 2: Проверка наличия листов ==========
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return {
          isValid: false,
          error: 'Файл не содержит листов'
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      // ========== Этап 3: Проверка что файл не пустой ==========
      if (data.length === 0) {
        return {
          isValid: false,
          error: 'Файл пустой (нет данных)'
        };
      }

      // ========== Этап 4: Определение типа документа ==========
      const firstRow = data[0];

      if (this.hasRequiredColumns(firstRow, this.osvColumns)) {
        return this.analyzeOsv(data);
      }

      if (this.hasRequiredColumns(firstRow, this.osColumns)) {
        return this.analyzeOs(data);
      }

      // ========== Ни один тип не подошёл ==========
      return {
        isValid: false,
        error: `Некорректная структура данных. Файл должен содержать колонки для ОСВ (${this.osvColumns.join(', ')}) или для ОС (${this.osColumns.join(', ')})`
      };

    } catch (error) {
      let errorMessage = 'Ошибка чтения файла';
      if (error.message?.includes('Unsupported file')) {
        errorMessage = 'Формат файла не поддерживается';
      }

      console.error(`Ошибка анализа Excel: ${error.message}`, error.stack);

      this.logsService.log('backend', null, {
        action: 'excel_analysis',
        result: 'error',
        error: errorMessage,
        originalError: error.message
      });

      return {
        isValid: false,
        error: `${errorMessage}: ${error.message}`
      };
    }
  }

  /**
   * Проверить наличие всех требуемых колонок в строке.
   * 
   * @param row - объект строки Excel (ключи — названия колонок)
   * @param requiredColumns - массив названий обязательных колонок
   * @returns true если ВСЕ требуемые колонки присутствуют, иначе false
   */
  private hasRequiredColumns(row: any, requiredColumns: string[]): boolean {
    for (const column of requiredColumns) {
      if (!(column in row)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Проанализировать документ ОСВ.
   * Собирает уникальные склады из колонки "Склад" и формирует description.
   * 
   * @param data - массив строк Excel
   * @returns Результат анализа с docType='ОСВ' и description
   */
  private analyzeOsv(data: any[]): {
    isValid: boolean;
    docType?: string;
    description?: string;
    error?: string;
  } {
    const sklads = new Set<string>();

    for (const row of data) {
      const sklad = row['Склад']?.toString()?.trim();
      if (sklad) {
        sklads.add(sklad);
      }
    }

    if (sklads.size === 0) {
      return {
        isValid: false,
        error: 'Не удалось определить склад (колонка "Склад" пустая во всех строках)'
      };
    }

    const sortedSklads = Array.from(sklads).sort();
    const description = `ОСВ ${sortedSklads.join(',')}`;

    this.logsService.log('backend', null, {
      action: 'excel_analysis',
      result: 'success',
      docType: 'ОСВ',
      description,
      sklads: sortedSklads
    });

    return {
      isValid: true,
      docType: 'ОСВ',
      description
    };
  }

  /**
   * Проанализировать документ ОС.
   * Собирает уникальные склады из колонки "МОЛ" и формирует description.
   * 
   * @param data - массив строк Excel
   * @returns Результат анализа с docType='ОС' и description
   */
  private analyzeOs(data: any[]): {
    isValid: boolean;
    docType?: string;
    description?: string;
    error?: string;
  } {
    const sklads = new Set<string>();

    for (const row of data) {
      const sklad = row['МОЛ']?.toString()?.trim();
      if (sklad) {
        sklads.add(sklad);
      }
    }

    if (sklads.size === 0) {
      return {
        isValid: false,
        error: 'Не удалось определить склад (колонка "МОЛ" пустая во всех строках)'
      };
    }

    const sortedSklads = Array.from(sklads).sort();
    const description = `ОС ${sortedSklads.join(',')}`;

    this.logsService.log('backend', null, {
      action: 'excel_analysis',
      result: 'success',
      docType: 'ОС',
      description,
      sklads: sortedSklads
    });

    return {
      isValid: true,
      docType: 'ОС',
      description
    };
  }
}