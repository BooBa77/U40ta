import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AppEventsModule } from '../app-events/app-events.module';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './services/objects.service';
import { InventoryObject } from './entities/object.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryObject]),
    AppEventsModule, // Для SSE уведомлений
    JwtAuthModule, // Для JAuthGuard    
  ],
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}