import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MolAccess } from './entities/mol-access.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { Revisors } from './entities/revisors.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MolAccess, Revisors]),
    JwtAuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}