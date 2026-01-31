import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MolAccess } from './entities/mol-access.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [
    // TypeOrmModule.forFeature() - регистрирует сущности для работы в этом модуле
    // В отличие от forRoot() в app.module, который настраивает всё подключение к БД,
    // forFeature() сообщает TypeORM какие именно сущности (таблицы) будут использоваться в этом модуле
    // [User] - массив сущностей, которые принадлежат этому модулю
    TypeOrmModule.forFeature([User, MolAccess]),
    JwtAuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}