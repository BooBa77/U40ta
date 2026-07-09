import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { MolController } from './mol.controller';
import { MolService } from './mol.service';
import { InventoryObject } from '../objects/entities/object.entity';
import { Log } from '../logs/logs.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryObject, Log]),
    JwtAuthModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [MolController],
  providers: [MolService],
  exports: [MolService],
})
export class MolModule {}