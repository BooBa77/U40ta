import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { LogsService } from '../../logs/logs.service';

@Injectable()
export class EmailFileAnalyzer {
  private readonly osvColumns = [
    'Завод',
    'Склад',
    'КрТекстМатериала',
    'Материал',
    'Партия',
    'Запас на конец периода'
  ];

  private readonly osColumns = [
    'МОЛ',
    'Название',
    'Инвентарный номер'
  ];

  constructor(private readonly logsService: LogsService) {}

  async analyzeExcel(buffer: Buffer): Promise<{
    isValid: boolean;
    docType?: string;
    description?: string;
    error?: string;
  }> {
    try {
      console.log('=== EMAIL FILE ANALYZER ===');
      
      // Этап 1: Чтение Excel из Buffer
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      console.log(`📄 Прочитан Excel, количество листов: ${workbook.SheetNames.length}`);
      console.log(`📄 Имена листов: ${workbook.SheetNames.join(', ')}`);

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        console.log('❌ Файл не содержит листов');
        return {
          isValid: false,
          error: 'Файл не содержит листов'
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Количество строк данных: ${data.length}`);

      if (data.length === 0) {
        console.log('❌ Файл пустой (нет данных)');
        return {
          isValid: false,
          error: 'Файл пустой (нет данных)'
        };
      }

      // Этап 4: Определение типа документа
      const firstRow = data[0];
      console.log('🔍 Первая строка данных:', JSON.stringify(firstRow, null, 2));
      console.log('🔍 Ключи (колонки) первой строки:', Object.keys(firstRow));

      // Проверка на ОСВ
      const hasOsvColumns = this.hasRequiredColumns(firstRow, this.osvColumns);
      console.log(`📋 Проверка ОСВ: ${hasOsvColumns}`);
      if (!hasOsvColumns) {
        console.log(`📋 Отсутствуют колонки ОСВ:`, this.osvColumns.filter(col => !(col in firstRow)));
      }

      if (hasOsvColumns) {
        console.log('✅ Файл определён как ОСВ');
        return this.analyzeOsv(data);
      }

      // Проверка на ОС
      const hasOsColumns = this.hasRequiredColumns(firstRow, this.osColumns);
      console.log(`📋 Проверка ОС: ${hasOsColumns}`);
      if (!hasOsColumns) {
        console.log(`📋 Отсутствуют колонки ОС:`, this.osColumns.filter(col => !(col in firstRow)));
      }

      if (hasOsColumns) {
        console.log('✅ Файл определён как ОС');
        return this.analyzeOs(data);
      }

      // Ни один тип не подошёл
      console.log('❌ Файл не соответствует ни ОСВ, ни ОС');
      console.log(`❌ Ожидаемые колонки ОСВ: ${this.osvColumns.join(', ')}`);
      console.log(`❌ Ожидаемые колонки ОС: ${this.osColumns.join(', ')}`);
      console.log(`❌ Фактические колонки: ${Object.keys(firstRow).join(', ')}`);

      return {
        isValid: false,
        error: `Некорректная структура данных. Ожидаются колонки для ОСВ (${this.osvColumns.join(', ')}) или для ОС (${this.osColumns.join(', ')})`
      };

    } catch (error) {
      let errorMessage = 'Ошибка чтения файла';
      if (error.message?.includes('Unsupported file')) {
        errorMessage = 'Формат файла не поддерживается';
      }

      console.error(`❌ Ошибка анализа Excel: ${error.message}`, error.stack);

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

  private hasRequiredColumns(row: any, requiredColumns: string[]): boolean {
    for (const column of requiredColumns) {
      if (!(column in row)) {
        return false;
      }
    }
    return true;
  }

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

    console.log(`📝 Результат ОСВ: ${description}, склады: ${sortedSklads.join(', ')}`);

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

    console.log(`📝 Результат ОС: ${description}, МОЛ: ${sortedSklads.join(', ')}`);

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