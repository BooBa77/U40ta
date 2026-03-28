// Типизация строк из Excel файла ведомости ОСВ
export interface ParsedOSVExcelRowDto {
  'Завод': number;
  'Склад': string;
  'КрТекстМатериала': string;
  'Материал': string;
  'Партия': string;
  'Запас на конец периода': number;
}