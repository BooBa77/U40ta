import { IsString, IsNotEmpty, MaxLength, IsInt, Min } from 'class-validator';

export class CreateQrCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qr_value: string;

  @IsInt()
  object_id: number;

  @IsInt()
  @Min(1)  // ID пользователя не может быть 0 или отрицательным
  changed_by: number;
}