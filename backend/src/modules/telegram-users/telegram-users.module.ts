import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUsersService } from './telegram-users.service';
import { TelegramUsersController } from './telegram-users.controller';
import { TelegramUser } from './entities/telegram-user.entity';
import { JwtAuthModule } from '../auth/jwt-auth.module'; // <-- Заменяем AuthModule на JwtAuthModule

@Module({
  imports: [
    // TypeOrmModule.forFeature() - регистрирует сущности для работы в этом модуле
    // В отличие от forRoot() в app.module, который настраивает всё подключение к БД,
    // forFeature() сообщает TypeORM какие именно сущности (таблицы) будут использоваться в этом модуле
    // [TelegramUser] - массив сущностей, которые принадлежат этому модулю
    TypeOrmModule.forFeature([TelegramUser]),
    
    // JwtAuthModule - импортируем модуль JWT аутентификации чтобы использовать JwtAuthGuard
    // JwtAuthModule содержит JwtAuthGuard и все его зависимости (JwtService, ConfigService)
    // Без этого импорта TelegramUsersController не сможет использовать @UseGuards(JwtAuthGuard)
    // потому что зависимости guard'а не будут доступны в контексте этого модуля
    // JwtAuthModule - это отдельный модуль только для JWT, без бизнес-логики авторизации
    JwtAuthModule, // <-- Заменяем AuthModule на JwtAuthModule
  ],
  
  controllers: [TelegramUsersController],
  // controllers - массив контроллеров, которые обрабатывают HTTP запросы
  // TelegramUsersController будет обрабатывать запросы, начинающиеся с /telegram-users
  // Например: GET /telegram-users, POST /telegram-users и т.д.
  
  providers: [TelegramUsersService],
  // providers - сервисы (провайдеры), которые содержат бизнес-логику модуля
  // TelegramUsersService будет доступен для внедрения в контроллеры этого модуля
  // и в другие модули, которые импортируют TelegramUsersModule
  
  exports: [TelegramUsersService],
  // exports - делает провайдеры этого модуля доступными для других модулей
  // TelegramUsersService теперь можно использовать в AuthModule и других модулях
  // которые импортируют TelegramUsersModule
})
export class TelegramUsersModule {}