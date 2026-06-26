import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProposedChangeDto {
  @IsNotEmpty()
  @IsInt()
  objectId!: number;

  @IsEnum(['place', 'sn', 'comment', 'photo'])
  changeType!: string;

  @IsObject()
  @IsOptional()
  proposedData?: Record<string, any>;

  @IsInt()
  @IsOptional()
  photoId?: number;
}

export class CreateProposedChangesBatchDto {
  @ValidateNested({ each: true })
  @Type(() => CreateProposedChangeDto)
  changes!: CreateProposedChangeDto[];
}