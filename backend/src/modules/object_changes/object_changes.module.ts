import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectChange } from './entities/object-change.entity';
import { ObjectChangesService } from './services/object-changes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectChange])],
  providers: [ObjectChangesService],
  exports: [ObjectChangesService],
})
export class ObjectChangesModule {}