import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from './entities/qr-code.entity';
import { QrCodesService } from './qr-codes.service';
import { QrCodesController } from './qr-codes.controller';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QrCode]),
    JwtAuthModule,
  ],
  controllers: [QrCodesController],
  providers: [QrCodesService],
  exports: [QrCodesService],
})
export class QrCodesModule {}