import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ProposedChange } from './entities/proposed-change.entity';
import { ProposedChangesController } from './proposed-changes.controller';
import { ProposedChangesService } from './proposed-changes.service';
import { UsersModule } from '../users/users.module';

/**
 * Модуль предлагаемых изменений.
 * 
 * ## Назначение
 * Принимает изменения от гостей (пользователей без доступа МОЛ к складу):
 * - Сохранение предложенных изменений в БД
 * - Просмотр списка pending-изменений для МОЛ
 * - Подтверждение/отклонение изменений МОЛом
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProposedChange]),
    JwtAuthModule,
    UsersModule,
  ],
  controllers: [ProposedChangesController],
  providers: [ProposedChangesService],
  exports: [ProposedChangesService],
})
export class ProposedChangesModule {}