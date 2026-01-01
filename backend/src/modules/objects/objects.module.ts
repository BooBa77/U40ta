import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryObject } from './entities/object.entity';
import { ObjectsService } from './objects.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryObject])],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}