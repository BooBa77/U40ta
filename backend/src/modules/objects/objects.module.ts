import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './services/objects.service';
import { InventoryObject } from './entities/object.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryObject])],
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}