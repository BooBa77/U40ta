import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppEventsModule } from './modules/app-events/app-events.module'; // SSE
import { TelegramUsersModule } from './modules/telegram-users/telegram-users.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { LogsModule } from './modules/logs/logs.module';
import { EmailModule } from './modules/email/email.module';
import emailConfig from './modules/email/config/email.config';
import { StatementsModule } from './modules/statements/statements.module';
import { OfflineModule } from './modules/offline/offline.module';
import { ObjectsModule } from './modules/objects/objects.module';
import { QrCodesModule } from './modules/qr-codes/qr-codes.module';
import { PhotosModule } from './modules/photos/photos.module';

@Module({
  imports: [
    // ConfigModule - модуль для работы с переменными окружения
    // isGlobal: true делает конфигурацию доступной во всех модулях приложения без дополнительного импорта
    ConfigModule.forRoot({
      isGlobal: true,
      load: [emailConfig],  
      envFilePath: '.env',
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

    // Модуль логгирования
    ThrottlerModule.forRoot([{
          ttl: 60000,  // время жизни окна в миллисекундах (1 минута)
          limit: 50,   // максимальное количество запросов за окно
        }]),
    LogsModule,    

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

    // StatementsModule - модуль работы с электронной почтой
    // Сервисы получения excel-таблиц и выгрузки выборок
    StatementsModule,

    // Модуль работы в оффлайн режиме
    // Сервисы кэширования из БД в IndexDB и обратная синхронизация
    OfflineModule,

    // ObjectsModule - модуль работы с объектами инвентарного учёта
    // Предоставляет CRUD операции для объектов склада с полями: инв.номер, серийный номер, место использования
    ObjectsModule,

    // Модуль работы с QR-кодами
    // Обеспечивает связь отсканированных QR-значений с объектами системы
    QrCodesModule,

    // Модуль работы с фотографиями
    // Обеспечивает связь таблицы фотографий с объектами системы
    PhotosModule,
  ],
  
  // providers - массив сервисов, не объявленных в других модулях
  providers: [],  
})
export class AppModule {}