import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class PhotoHistoryDto {
  @IsInt()
  @IsNotEmpty()
  objectId!: number;

  @IsInt()
  @IsNotEmpty()
  photoId!: number;
}