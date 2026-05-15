import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { LogsService } from '../../logs/logs.service';

/**
 * Сервис анализа Excel-файлов, поступающих по электронной почте.
 * 
 * ## Назначение
 * Определяет тип документа (ОСВ или ОС) по заголовкам колонок и извлекает
 * информацию о складе из первой непустой строки.
 * 
 * ## Поддерживаемые типы документов
 * - **ОСВ** (оборотно-сальдовая ведомость) — колонки: Завод, Склад, КрТекстМатериала,
 *   Материал, Партия, Запас на конец периода
 * - **ОС** (основные средства) — колонки: Основное средство, Название, Инвентарный номер, МОЛ
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
    'Запас на конец периода'
  ];

  /**
   * Обязательные колонки для документа типа ОС (основные средства).
   * Файл считается ОС, если в первой строке присутствуют ВСЕ эти колонки.
   */
  private readonly osColumns = [
    'Основное средство',
    'Название',
    'Инвентарный номер',
    'МОЛ'
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
   * 5. Извлечение zavod и sklad из первой непустой строки
   * 
   * ## Результат
   * - Для валидного файла: `{ isValid: true, docType, zavod, sklad }`
   * - Для невалидного: `{ isValid: false, error }`
   * 
   * Для инвентаризационных ведомостей (is_inventory = true) используются
   * только поля `isValid` и `docType`, zavod/sklad игнорируются.
   * 
   * @param buffer - содержимое Excel-файла в виде Buffer
   * @returns Объект с результатом анализа
   */
  async analyzeExcel(buffer: Buffer): Promise<{
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  }> {
    try {
      // ========== Этап 1: Чтение Excel из Buffer ==========
      // Библиотека xlsx умеет читать напрямую из Buffer
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

      // Конвертируем лист в массив объектов (каждая строка — объект с ключами-колонками)
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

      // Сначала проверяем на ОСВ (более частый тип)
      if (this.hasRequiredColumns(firstRow, this.osvColumns)) {
        return this.extractOsvData(data);
      }

      // Затем проверяем на ОС
      if (this.hasRequiredColumns(firstRow, this.osColumns)) {
        return this.extractOsData(data);
      }

      // ========== Ни один тип не подошёл ==========
      return {
        isValid: false,
        error: `Некорректная структура данных. Файл должен содержать колонки для ОСВ (${this.osvColumns.join(', ')}) или для ОС (${this.osColumns.join(', ')})`
      };

    } catch (error) {
      // ========== Обработка ошибок чтения ==========
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
   * Используется для определения типа документа: если в первой строке
   * присутствуют ВСЕ обязательные колонки определённого типа — документ
   * считается валидным для этого типа.
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
   * Извлечь zavod и sklad из первой непустой строки документа ОСВ.
   * 
   * Проходит по строкам сверху вниз, ищет первую строку с непустым складом.
   * 
   * @param data - массив строк Excel
   * @returns Результат с docType='ОСВ', zavod и sklad или ошибкой
   */
  private extractOsvData(data: any[]): {
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  } {
    for (const row of data) {
      const rowZavod = row['Завод'];
      const rowSklad = row['Склад'];

      // Извлекаем zavod — приводим к числу
      let zavod = 0;
      if (typeof rowZavod === 'number') {
        zavod = rowZavod;
      } else if (typeof rowZavod === 'string') {
        const parsed = parseInt(rowZavod.trim(), 10);
        zavod = isNaN(parsed) ? 0 : parsed;
      } else {
        zavod = Number(rowZavod) || 0;
      }

      // Проверяем, что склад не пустой
      if (rowSklad && typeof rowSklad === 'string' && rowSklad.trim() !== '') {
        this.logsService.log('backend', null, {
          action: 'excel_analysis',
          result: 'success',
          docType: 'ОСВ',
          zavod,
          sklad: rowSklad.trim()
        });

        return {
          isValid: true,
          docType: 'ОСВ',
          zavod,
          sklad: rowSklad.trim()
        };
      }
    }

    // Все строки с пустым складом
    return {
      isValid: false,
      error: 'Не удалось определить склад (колонка "Склад" пустая во всех строках)'
    };
  }

  /**
   * Извлечь sklad из первой непустой строки документа ОС.
   * 
   * Проходит по строкам сверху вниз, ищет первую строку с непустым МОЛ.
   * Для ОС zavod всегда 0.
   * 
   * @param data - массив строк Excel
   * @returns Результат с docType='ОС', zavod=0 и sklad или ошибкой
   */
  private extractOsData(data: any[]): {
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  } {
    for (const row of data) {
      const rowMol = row['МОЛ'];

      if (rowMol !== undefined && rowMol !== null && rowMol !== '') {
        const sklad = String(rowMol).trim();
        if (sklad !== '') {
          this.logsService.log('backend', null, {
            action: 'excel_analysis',
            result: 'success',
            docType: 'ОС',
            sklad
          });

          return {
            isValid: true,
            docType: 'ОС',
            zavod: 0,
            sklad
          };
        }
      }
    }

    // Ошибка - все строки с пустым МОЛ
    return {
      isValid: false,
      error: 'Не удалось определить склад (колонка "МОЛ" пустая во всех строках)'
    };
  }
}