import { IsInt, IsBoolean } from 'class-validator';

export class UpdateHaveObjectDto {
  @IsInt()
  statementId: number;

  @IsBoolean()
  haveObject: boolean;
}