import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { Log } from './logs.entity';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Global() // Делаем модуль глобальным, чтобы не импортировать везде
@Module({
  imports: [
    TypeOrmModule.forFeature([Log]),
    JwtAuthModule,
  ],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}