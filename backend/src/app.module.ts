import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEventsModule } from './app-events/app-events.module'; // SSE
import { TelegramUsersModule } from './modules/telegram-users/telegram-users.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    // ConfigModule - модуль для работы с переменными окружения
    // isGlobal: true делает конфигурацию доступной во всех модулях приложения без дополнительного импорта
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // TypeOrmModule - модуль для работы с базой данных PostgreSQL
    // forRootAsync используется для асинхронной конфигурации, когда нужны данные из ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // Импортируем ConfigModule чтобы использовать ConfigService
      useFactory: (configService: ConfigService) => ({
        // Эта функция-фабрика вызывается NestJS в момент инициализации модуля
        // Она возвращает объект с настройками для подключения к базе данных
        // configService - это сервис, который дает доступ к переменным окружения, загруженные через ConfigModule.forRoot() - env-файл

        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        // Автоматическое подключение всех entity-классов в проекте
        // __dirname - текущая директория, /**/*.entity{.ts,.js} - ищет все файлы с .entity в названии
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // synchronize: false - ОТКЛЮЧЕНА автоматическая синхронизация схемы базы данных
        synchronize: false, // ОТКЛЮЧЕНА, чтобы не затереть данные
      }),
      inject: [ConfigService], // Внедряем ConfigService в фабрику
    }),

    // Импорты наших модулей приложения
    
    // AppEventsModule - система реального времени (SSE) для мгновенных уведомлений клиентов
    // Объединяет уведомления из разных модулей: email, файлы, пользователи
    AppEventsModule,

    // TelegramUsersModule - модуль для работы с заявками на авторизацию от пользователей Telegram
    // Содержит сущность telegram_users и сервисы для работы с ней
    TelegramUsersModule,
    
    // UsersModule - модуль для работы с пользователями системы
    // Содержит сущность users и сервисы для работы с ней
    UsersModule,
    
    // AuthModule - модуль аутентификации и авторизации
    // Обрабатывает логику входа через Telegram и другие методы
    AuthModule,

    // EmailModule - модуль работы с электронной почтой
    // Сервисы получения excel-таблиц и выгрузки выборок
    EmailModule,
  ],
  
  // providers - массив сервисов, не объявленных в других модулях
  providers: [],  
})
export class AppModule {}