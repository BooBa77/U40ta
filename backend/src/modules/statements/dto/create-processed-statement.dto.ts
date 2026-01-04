// Для создания новых записей в processed_statements
export class CreateProcessedStatementDto {
  emailAttachmentId: number;
  zavod: number;          // NOT NULL в БД
  sklad: string;          // NOT NULL в БД  
  doc_type: string;       // NOT NULL в БД
  inv_number: string;     // NOT NULL в БД
  party_number: string;   // NOT NULL в БД
  buh_name: string;       // NOT NULL в БД
  have_object?: boolean = false;
  is_ignore?: boolean = false;
  is_excess?: boolean = false;
}