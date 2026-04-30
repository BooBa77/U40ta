import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogsService } from './logs.service';
import { ObjectHistoryDto } from './dto/object-history.dto';
import { QrCodeHistoryDto } from './dto/qr-code-history.dto';
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
    // source принудительно 'frontend' — пользователь не может это подменить
    this.logsService.log('frontend', req.user?.sub || null, body.content);
    return { success: true };
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
}