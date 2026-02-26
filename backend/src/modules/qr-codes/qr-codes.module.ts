import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from './entities/qr-code.entity';
import { QrCodesService } from './qr-codes.service';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesHistoryModule } from '../qr-codes-history/qr-codes-history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QrCode]),
    QrCodesHistoryModule, // Импортируем модуль истории
  ],
  controllers: [QrCodesController],
  providers: [QrCodesService],
  exports: [QrCodesService],
})
export class QrCodesModule {}