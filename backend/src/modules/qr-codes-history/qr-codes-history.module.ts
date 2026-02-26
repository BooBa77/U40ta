import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCodesChange } from './entities/qr-codes-change.entity';
import { QrCodesHistoryService } from './qr-codes-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([QrCodesChange])],
  providers: [QrCodesHistoryService],
  exports: [QrCodesHistoryService],
})
export class QrCodesHistoryModule {}