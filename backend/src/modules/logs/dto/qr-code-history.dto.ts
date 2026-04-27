import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class QrCodeHistoryDto {
  @IsString()
  @IsNotEmpty()
  qrCodeValue!: string;

  @IsInt()
  @IsNotEmpty()
  oldObjectId!: number;

  @IsInt()
  @IsNotEmpty()
  newObjectId!: number;
}