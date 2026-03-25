export class EmailAttachmentResponseDto {
  id: number;
  filename: string;
  emailFrom: string | null;
  receivedAt: Date;
  docType: string | null;
  zavod: number;
  sklad: string | null;
  inProcess: boolean;
  isInventory: boolean;
}