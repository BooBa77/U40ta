import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ObjectHistory } from './entities/object_history.entity';
import { ObjectHistoryService } from './object_history.service';
import { ObjectHistoryController } from './object_history.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ObjectHistory]),
    JwtAuthModule,
  ],
  controllers: [ObjectHistoryController],
  providers: [ObjectHistoryService],
  exports: [ObjectHistoryService],
})
export class ObjectHistoryModule {}