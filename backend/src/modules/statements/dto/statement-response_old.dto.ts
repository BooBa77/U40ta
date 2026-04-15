import { ProcessedStatement } from '../entities/processed-statement.entity';

export class StatementResponseDto {
  success!: boolean;
  attachmentId!: number;
  statements!: ProcessedStatement[];
  count!: number;
  message?: string;
  error?: string;
}