import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ObjectChange } from './entities/object-change.entity';
import { ObjectChangesService } from './objects_changes.service';
import { ObjectChangesController } from './object_changes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ObjectChange]),
    JwtAuthModule,
  ],
  controllers: [ObjectChangesController],
  providers: [ObjectChangesService],
  exports: [ObjectChangesService],
})
export class ObjectChangesModule {}