export class EmailAttachmentResponseDto {
  id: number;
  filename: string;
  email_from: string | null;
  received_at: Date;
  doc_type: string | null;
  zavod: number;
  sklad: string | null;
  in_process: boolean;
  is_inventory: boolean;
}