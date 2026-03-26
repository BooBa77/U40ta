import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogsService } from './logs.service';

interface RequestWithUser extends Express.Request {
  user?: { sub: number };
}

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
}