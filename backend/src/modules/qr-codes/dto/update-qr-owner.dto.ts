import { IsString, IsNotEmpty, MaxLength, IsInt } from 'class-validator';

export class UpdateQrOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qrValue!: string;

  @IsInt()
  newObjectId!: number;
}