import { IsString, IsNotEmpty, MaxLength, IsInt } from 'class-validator';

export class CreateQrCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qr_value: string;

  @IsInt()
  object_id: number;
}