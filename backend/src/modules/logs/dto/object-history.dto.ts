import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class ObjectHistoryDto {
  @IsInt()
  @IsNotEmpty()
  objectId!: number;

  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  storyLine!: string;
}