import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class EmailFileAnalyzer {
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
      
      // Этап 5: Проверка обязательных колонок
      const requiredColumns = [
        'Завод',
        'Склад', 
        'КрТекстМатериала',
        'Материал',
        'Партия',
        'Запас на конец периода'
      ];

      const missingColumns: string[] = [];
      for (const column of requiredColumns) {
        if (!(column in firstRow)) {
          missingColumns.push(column);
        }
      }

      if (missingColumns.length > 0) {
        return {
          isValid: false,
          error: `Некорректная структура данных. Отсутствуют колонки: ${missingColumns.join(', ')}`
        };
      }

      // Этап 6: Поиск первой строки с данными (где склад не пустой)
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
      return {
        isValid: true,
        docType: 'ОСВ',
        zavod: zavod,
        sklad: sklad
      };

    } catch (error) {
      console.error('Ошибка анализа Excel файла:', error);
      
      let errorMessage = 'Ошибка чтения файла';
      if (error.message.includes('not a valid zip file')) {
        errorMessage = 'Файл поврежден или не является Excel-файлом';
      } else if (error.message.includes('file not found')) {
        errorMessage = 'Файл не найден';
      }

      return {
        isValid: false,
        error: `${errorMessage}: ${error.message}`
      };
    }
  }
}