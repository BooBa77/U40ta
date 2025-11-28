import { Module } from '@nestjs/common';
import { AppEventsService } from './app-events.service';
import { AppEventsController } from './app-events.controller';

@Module({
  providers: [AppEventsService],
  controllers: [AppEventsController],
  exports: [AppEventsService], // Важно! Чтобы другие модули могли использовать
})
export class AppEventsModule {}