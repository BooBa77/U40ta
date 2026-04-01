import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class ObjectHistoryDto {
  @IsInt()
  @IsNotEmpty()
  object_id: number;

  @IsString()
  @IsNotEmpty()
  event_type: string;

  @IsString()
  @IsNotEmpty()
  story_line: string;
}