import { IsInt, IsString, IsNumber } from 'class-validator';

class SyncPhotoDto {
  max!: string;
  min!: string;
}

class SyncLogDto {
  source!: string;
  time!: string;
  content: any;
}

/*
export class SyncObjectDto {
  @IsInt()
  id!: number;

  @IsInt()
  zavod!: number;

  @IsString()
  sklad!: string;

  @IsString()
  buhName!: string;

  @IsString()
  invNumber!: string;

  // Без декораторов — не валидируются, но TypeScript о них знает
  partyNumber?: string | null;
  sn?: string | null;
  isWrittenOff?: boolean;
  checkedAt?: string;
  placeTer?: string | null;
  placePos?: string | null;
  placeCab?: string | null;
  placeUser?: string | null;
  qrCodes?: string[];
  photosToAdd?: SyncPhotoDto[];
  logs?: SyncLogDto[];
}
*/
export class SyncObjectDto {
  @IsNumber() id!: number;
  @IsInt() zavod!: number;
  @IsString() sklad!: string;
  @IsString() buhName!: string;
  @IsString() invNumber!: string;

  partyNumber?: string | null;
  sn?: string | null;
  isWrittenOff?: boolean;
  checkedAt?: string;
  placeTer?: string | null;
  placePos?: string | null;
  placeCab?: string | null;
  placeUser?: string | null;
  qrCodes?: string[];
  photosToAdd?: SyncPhotoDto[];
  logs?: SyncLogDto[];
}