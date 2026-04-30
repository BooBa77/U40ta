import { IsNotEmpty, IsInt } from 'class-validator';

export class CreatePhotoDto {
  @IsNotEmpty()
  @IsInt()
  objectId!: number;
  // файлы будем принимать через multer отдельно
}