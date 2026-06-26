import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ProposedChange } from './entities/proposed-change.entity';
import { ProposedChangesController } from './proposed-changes.controller';
import { ProposedChangesService } from './proposed-changes.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { InventoryObject } from '../objects/entities/object.entity';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProposedChange, User, InventoryObject]),
    JwtAuthModule,
    UsersModule,
    PhotosModule,
  ],
  controllers: [ProposedChangesController],
  providers: [ProposedChangesService],
  exports: [ProposedChangesService],
})
export class ProposedChangesModule {}