// DTO для ответа с историей изменений
export interface ObjectChangeResponseDto {
  id: number;
  object_id: number;
  story_line: string;
  changed_by: number;
  changed_at: Date;
  // Связанные данные
  object?: {
    id: number;
    inv_number?: string;
    party_number?: string;
  };
}