// Типизация строк из Excel файла
export interface ParsedOSVExcelRowDto {
  'Завод': number;
  'Склад': string;
  'КрТекстМатериала': string;
  'Материал': string;
  'Партия': string;
  'Запас на конец периода': number;
}