import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { LogsService } from '../../logs/logs.service';

@Injectable()
export class EmailFileAnalyzer {
  // Колонки для ОСВ (оборотно-сальдовая ведомость)
  private readonly osvColumns = [
    'Завод',
    'Склад',
    'КрТекстМатериала',
    'Материал',
    'Партия',
    'Запас на конец периода'
  ];

  // Колонки для ОС (основные средства)
  private readonly osColumns = [
    'Основное средство',
    'Название',
    'Инвентарный номер',
    'МОЛ'
  ];

  constructor(private readonly logsService: LogsService) {}

  /**
   * Анализирует Excel-файл и определяет его валидность, тип и склад
   * @param filePath - путь к файлу на диске
   * @returns Результат анализа
   */
  async analyzeExcel(filePath: string): Promise<{
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  }> {
    console.log(`Анализируем Excel файл: ${filePath}`);
    this.logsService.log('backend', null, {
      action: 'excel_analysis',
      filePath: filePath,
      status: 'started'
    });    

    // Этап 1: Проверка расширения файла
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return {
        isValid: false,
        error: 'Это не Excel-таблица. Поддерживаются только .xlsx и .xls файлы'
      };
    }

    // Этап 2: Проверка существования файла
    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        error: 'Файл не найден на диске'
      };
    }

    try {
      // Этап 3: Чтение Excel файла
      const workbook = XLSX.readFile(filePath);
      
      // Берём первый лист (по умолчанию)
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return {
          isValid: false,
          error: 'Файл не содержит листов'
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      
      // Конвертируем в JSON (массив объектов)
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      // Этап 4: Проверка что файл не пустой
      if (data.length === 0) {
        return {
          isValid: false,
          error: 'Файл пустой (нет данных)'
        };
      }

      // Берём первую строку для проверки колонок
      const firstRow = data[0];

      // Этап 5: Определение типа документа
      // Сначала проверяем на ОСВ (более популярный тип)
      const hasOsvColumns = this.hasRequiredColumns(firstRow, this.osvColumns);
      
      if (hasOsvColumns) {
        return await this.analyzeOsvDocument(data);
      }

      // Проверяем на ОС
      const hasOsColumns = this.hasRequiredColumns(firstRow, this.osColumns);
      
      if (hasOsColumns) {
        return await this.analyzeOsDocument(data);
      }

      // Если ни один тип не подошёл
      return {
        isValid: false,
        error: `Некорректная структура данных. Файл должен содержать колонки для ОСВ (${this.osvColumns.join(', ')}) или для ОС (${this.osColumns.join(', ')})`
      };

    } catch (error) {
      
      let errorMessage = 'Ошибка чтения файла';
      if (error.message.includes('not a valid zip file')) {
        errorMessage = 'Файл поврежден или не является Excel-файлом';
      } else if (error.message.includes('file not found')) {
        errorMessage = 'Файл не найден';
      }

      console.error(`Ошибка анализа Excel файла: ${error.message}`, error.stack);
      this.logsService.log('backend', null, {
        action: 'excel_analysis',
        result: 'error',
        filePath,
        error: errorMessage
      });

      return {
        isValid: false,
        error: `${errorMessage}: ${error.message}`
      };
    }
  }

  /**
   * Проверяет наличие всех требуемых колонок в строке
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
   * Анализирует документ типа ОСВ
   */
  private async analyzeOsvDocument(data: any[]): Promise<{
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  }> {
    // Поиск первой строки с данными (где склад не пустой)
    let zavod = 0;
    let sklad = '';
    
    for (const row of data) {
      const rowZavod = row['Завод'];
      const rowSklad = row['Склад'];
      
      // Приводим zavod к числу
      if (typeof rowZavod === 'number') {
        zavod = rowZavod;
      } else if (typeof rowZavod === 'string') {
        const parsed = parseInt(rowZavod.trim(), 10);
        zavod = isNaN(parsed) ? 0 : parsed;
      } else {
        zavod = Number(rowZavod) || 0;
      }
      
      if (rowSklad && typeof rowSklad === 'string' && rowSklad.trim() !== '') {
        sklad = rowSklad.trim();
        break;
      }
    }

    if (!sklad) {
      return {
        isValid: false,
        error: 'Не удалось определить склад (колонка "Склад" пустая во всех строках)'
      };
    }

    // Всё ок - файл валидный ОСВ
    this.logsService.log('backend', null, {
      action: 'excel_analysis',
      result: 'success',
      docType: 'ОСВ',
      zavod,
      sklad
    });    
    
    return {
      isValid: true,
      docType: 'ОСВ',
      zavod: zavod,
      sklad: sklad
    };
  }

  /**
   * Анализирует документ типа ОС (основные средства)
   */
  private async analyzeOsDocument(data: any[]): Promise<{
    isValid: boolean;
    docType?: string;
    zavod?: number;
    sklad?: string;
    error?: string;
  }> {
    // Поиск первой строки с данными (где МОЛ не пустой)
    let sklad = '';
    
    for (const row of data) {
      const rowMol = row['МОЛ'];
      // Проверяем наличие значения (независимо от типа)
      if (rowMol !== undefined && rowMol !== null && rowMol !== '') {
        sklad = String(rowMol).trim();
        if (sklad !== '') {
          break;
        }
      }
    }

    if (!sklad) {
      return {
        isValid: false,
        error: 'Не удалось определить склад (колонка "МОЛ" пустая во всех строках)'
      };
    }

    // Всё ок - файл валидный ОС
    this.logsService.log('backend', null, {
      action: 'excel_analysis',
      result: 'success',
      docType: 'ОС',
      sklad
    });    
    return {
      isValid: true,
      docType: 'ОС',
      zavod: 0,  // У ОС нет завода, ставим 0 для единообразия
      sklad: sklad
    };
  }
}