import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { UsersModule } from '../users/users.module';
import { TelegramUsersModule } from '../telegram-users/telegram-users.module';
import { JwtAuthModule } from './jwt-auth.module'; // <-- Импортируем JWT модуль

@Module({
  imports: [
    // Модули для работы с пользователями
    UsersModule,           // Для проверки одобренных пользователей
    TelegramUsersModule,   // Для работы с заявками
    JwtAuthModule,         // Для использования JwtService в AuthService
  ],
  controllers: [
    AuthController,        // Контроллер для обработки HTTP запросов авторизации
  ],
  providers: [
    AuthService,           // Главный сервис авторизации (проверка пользователей + JWT)
    TelegramAuthService,   // Сервис для логики работы с Telegram заявками
    // JwtAuthGuard больше не регистрируем здесь - он в JwtAuthModule
  ],
  // Убираем exports - guard теперь экспортируется из JwtAuthModule
})
export class AuthModule {}