import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppEventsService } from './app-events.service';

@Controller('app-events')
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

  @Sse('sse')
  sse(): Observable<{ message: string }> {
    return this.appEventsService.getEventStream();
  }
}