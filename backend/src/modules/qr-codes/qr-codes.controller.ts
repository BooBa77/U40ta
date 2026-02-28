import { 
  Controller, 
  Get, 
  Post,
  Put,
  Delete,
  Body, 
  Param, 
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { QrCodesService } from './qr-codes.service';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrOwnerDto } from './dto/update-qr-owner.dto';

@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  // Главный метод: поиск объекта по QR
  @Get('scan')
  async scanQr(@Query('qr') qrValue: string) {
    return this.qrCodesService.findObjectByQr(qrValue);
  }

  // Создать QR
  @Post()
  create(@Body() createQrCodeDto: CreateQrCodeDto) {
    return this.qrCodesService.create(createQrCodeDto);
  }

  // Переназначить QR
  @Put('update-owner')
  async updateOwner(@Body() updateQrOwnerDto: UpdateQrOwnerDto) {
    return this.qrCodesService.updateOwner(updateQrOwnerDto);
  }
}