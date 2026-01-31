import { IsString, IsNotEmpty, MaxLength, IsInt } from 'class-validator';

export class UpdateQrOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qr_value: string;

  @IsInt()
  new_object_id: number;
}