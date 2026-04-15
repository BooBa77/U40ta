import { IsString, IsNotEmpty, MaxLength, IsInt } from 'class-validator';

export class CreateQrCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qrValue!: string;

  @IsInt()
  objectId!: number;
}