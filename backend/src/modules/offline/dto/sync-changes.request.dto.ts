import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncObjectDto } from './sync-object.dto';

/*
export class SyncChangesRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncObjectDto)
  changes!: SyncObjectDto[];
}
*/
/*
export class SyncChangesRequestDto {
  @IsArray()
  changes!: any[];
}
*/
export class SyncChangesRequestDto {
  @IsArray()
  changes!: SyncObjectDto[];
}