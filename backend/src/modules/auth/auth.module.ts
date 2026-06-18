import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { UsersModule } from '../users/users.module';
import { TelegramUsersModule } from '../telegram-users/telegram-users.module';
import { JwtAuthModule } from './jwt-auth.module';
import { EmailCodeService } from './services/email-code.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    // Модули для работы с пользователями
    UsersModule,           // Для проверки одобренных пользователей
    TelegramUsersModule,   // Для работы с заявками
    JwtAuthModule,         // Для использования JwtService в AuthService
    EmailModule,           // Для использования SmtpServic
  ],
  controllers: [
    AuthController,        // Контроллер для обработки HTTP запросов авторизации
  ],
  providers: [
    AuthService,           // Главный сервис авторизации (проверка пользователей + JWT)
    TelegramAuthService,   // Сервис для логики работы с Telegram заявками
    EmailCodeService,      // Сервис для авторизации по email
  ],
})
export class AuthModule {}