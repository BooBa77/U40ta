// Типизация строк из Excel файла ведомости ОСВ
export interface ParsedOSExcelRowDto {
  'Основное средство'?: string;
  'Название'?: string;
  'Инвентарный номер'?: string;
  'МОЛ'?: string;
}