import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from './entities/qr-code.entity';
import { QrCodesService } from './qr-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([QrCode])],
  providers: [QrCodesService],
  exports: [QrCodesService],
})
export class QrCodesModule {}