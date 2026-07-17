import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogsService } from './logs.service';
import { ObjectHistoryDto } from './dto/object-history.dto';
import { QrCodeHistoryDto } from './dto/qr-code-history.dto';
import { PhotoHistoryDto } from './dto/photo-history.dto';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface'

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  logFromFrontend(
    @Req() req: RequestWithUser,
    @Body() body: { content: any },
  ) {
    this.logsService.log('frontend', req.user?.sub || null, body.content);
    return { success: true };
  }

  /**
   * Получение истории изменений объекта
   * GET /api/logs/object-history/:objectId
   */
  @Get('object-history/:objectId')
  @UseGuards(JwtAuthGuard)
  async getObjectHistory(@Param('objectId') objectId: string) {
    const history = await this.logsService.getObjectHistory(Number(objectId));
    return {
      success: true,
      history,
    };
  }

  @Post('object-history')
  @UseGuards(JwtAuthGuard)
  createObjectHistory(
    @Req() req: RequestWithUser,
    @Body() dto: ObjectHistoryDto,
  ) {
    this.logsService.log(
      'object-history',
      req.user!.sub,
      {
        object_id: dto.objectId,
        event_type: dto.eventType,
        story_line: dto.storyLine,
      },
    );
    return { success: true };
  }
  
  @Post('qr-code-history')
  @UseGuards(JwtAuthGuard)
  createQrCodeHistory(
    @Req() req: RequestWithUser,
    @Body() dto: QrCodeHistoryDto,
  ) {
    this.logsService.log(
      'qr-code-history',
      req.user!.sub,
      {
        qr_code_value: dto.qrCodeValue,
        object_id: dto.objectId,
      },
    );
    return { success: true };
  }

  @Post('photo-history')
  @UseGuards(JwtAuthGuard)
  createPhotoHistory(
    @Req() req: RequestWithUser,
    @Body() dto: PhotoHistoryDto,
  ) {
    this.logsService.log(
      'photo-history',
      req.user!.sub,
      {
        object_id: dto.objectId,
        photo_id: dto.photoId,
      },
    );
    return { success: true };
  }  
}