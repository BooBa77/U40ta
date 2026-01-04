import { ProcessedStatement } from '../entities/processed-statement.entity';

export class StatementResponseDto {
  success: boolean;
  attachmentId: number;
  statements: ProcessedStatementDto[];
  count: number;
  message?: string;
  error?: string;
}

// Дополнительный DTO для представления одной записи
export class ProcessedStatementDto {
  id: number;
  emailAttachmentId: number;
  zavod: number;
  sklad: string;
  doc_type: string;
  inv_number: string;
  party_number: string;
  buh_name: string;
  have_object: boolean;
  is_ignore: boolean;
  is_excess: boolean;

  // Статический метод для преобразования из Entity
  static fromEntity(entity: ProcessedStatement): ProcessedStatementDto {
    const dto = new ProcessedStatementDto();
    dto.id = entity.id;
    dto.emailAttachmentId = entity.emailAttachmentId;
    dto.zavod = entity.zavod;
    dto.sklad = entity.sklad;
    dto.doc_type = entity.doc_type;
    dto.inv_number = entity.inv_number;
    dto.party_number = entity.party_number;
    dto.buh_name = entity.buh_name;
    dto.have_object = entity.have_object;
    dto.is_ignore = entity.is_ignore;
    dto.is_excess = entity.is_excess;
    return dto;
  }

  // Метод для преобразования массива Entity → DTO[]
  static fromEntities(entities: ProcessedStatement[]): ProcessedStatementDto[] {
    return entities.map(entity => ProcessedStatementDto.fromEntity(entity));
  }
}