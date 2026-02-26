import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateQrChangeDto {
  @IsInt()
  @IsNotEmpty()
  qr_code_id: number;

  @IsInt()
  @IsNotEmpty()
  old_object_id: number;

  @IsInt()
  @IsNotEmpty()
  new_object_id: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  changed_by: number;
}