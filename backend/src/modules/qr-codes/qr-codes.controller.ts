import { 
  Controller, 
  Get, 
  Post,
  Delete,
  Body, 
  Param, 
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { QrCodesService } from './qr-codes.service';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';

@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  // Главный метод: поиск объекта по QR
  @Get('scan')
  async scanQr(@Query('qr') qrValue: string) {
    return this.qrCodesService.findObjectByQr(qrValue);
  }

  // Создать QR (для админки/импорта)
  @Post()
  create(@Body() createQrCodeDto: CreateQrCodeDto) {
    return this.qrCodesService.create(createQrCodeDto);
  }

  // Удалить QR (редко, но может понадобиться)
  @Delete(':qr_value')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('qr_value') qrValue: string) {
    return this.qrCodesService.remove(qrValue);
  }
}