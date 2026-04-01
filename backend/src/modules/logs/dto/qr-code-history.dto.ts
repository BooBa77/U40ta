import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class QrCodeHistoryDto {
  @IsString()
  @IsNotEmpty()
  qr_code_value: string;

  @IsInt()
  @IsNotEmpty()
  old_object_id: number;

  @IsInt()
  @IsNotEmpty()
  new_object_id: number;
}