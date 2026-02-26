import { IsString, IsNotEmpty, MaxLength, IsInt, Min } from 'class-validator';

export class UpdateQrOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qr_value: string;

  @IsInt()
  new_object_id: number;

  @IsInt()
  @Min(1)
  changed_by: number; // ID пользователя, который выполняет изменение
}