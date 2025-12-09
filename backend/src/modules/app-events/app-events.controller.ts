import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppEventsService } from './app-events.service';

@Controller('app-events')
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

@Sse('sse')
sse(): Observable<MessageEvent> {
  return this.appEventsService.getEventStream().pipe(
    map(data => {
      return new MessageEvent('message', {
        data: JSON.stringify(data)
      });
    })
  );
}}