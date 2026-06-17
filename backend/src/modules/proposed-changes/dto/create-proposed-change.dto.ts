import { IsEnum, IsNotEmpty, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProposedChangeDto {
  @IsNotEmpty()
  objectId!: number;

  @IsEnum(['place', 'sn', 'comment', 'photo'])
  changeType!: string;

  @IsObject()
  proposedData!: Record<string, any>;
}

export class CreateProposedChangesBatchDto {
  @ValidateNested({ each: true })
  @Type(() => CreateProposedChangeDto)
  changes!: CreateProposedChangeDto[];
}