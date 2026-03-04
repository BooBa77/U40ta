import { 
  Controller, 
  Get, 
  Post,
  Put,
  Body, 
  Query, 
  UseGuards,
  Req 
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { QrCodesService } from './qr-codes.service';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrOwnerDto } from './dto/update-qr-owner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

// Интерфейс для типизации пользователя в запросе
interface RequestWithUser extends ExpressRequest {
  user?: {
    sub: number;  // ID пользователя из JWT токена
  };
}

@Controller('qr-codes')
@UseGuards(JwtAuthGuard)  // Защищаем все методы контроллера
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  // Главный метод: поиск объекта по QR
  @Get('scan')
  async scanQr(@Query('qr') qrValue: string) {
    return this.qrCodesService.findObjectByQr(qrValue);
  }

  // Создать QR
  @Post()
  async create(
    @Body() createQrCodeDto: CreateQrCodeDto,
    @Req() request: RequestWithUser
  ) {
    const userId = request.user?.sub;
    
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    
    return this.qrCodesService.create(createQrCodeDto, userId);
  }

  // Переназначить QR
  @Put('update-owner')
  async updateOwner(
    @Body() updateQrOwnerDto: UpdateQrOwnerDto,
    @Req() request: RequestWithUser
  ) {
    const userId = request.user?.sub;
    
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    
    return this.qrCodesService.updateOwner(updateQrOwnerDto, userId);
  }
}