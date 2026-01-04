// Типизация строк из Excel файла
export interface ParsedExcelRowDto {
  'Завод': number;
  'Склад': string;
  'КрТекстМатериала': string;
  'Материал': string;
  'Партия': string;
  'Запас на конец периода': number;
}