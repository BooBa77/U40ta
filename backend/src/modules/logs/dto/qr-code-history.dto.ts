import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class QrCodeHistoryDto {
  @IsString()
  @IsNotEmpty()
  qrCodeValue!: string;

  @IsInt()
  @IsNotEmpty()
  objectId!: number;
}