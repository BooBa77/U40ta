import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Создаем логгер с именем 'Bootstrap' для этого файла
  // Имя помогает понять откуда пришло сообщение в логах
  const logger = new Logger('Bootstrap');
  
  // Создаем экземпляр приложения NestJS
  // AppModule - корневой модуль, который объединяет все части приложения
  const app = await NestFactory.create(AppModule);

  // Добавляем глобальный префикс. Для dev будет задан из .env, для продакшн
  // app.setGlobalPrefix(process.env.API_PREFIX || '');
  app.setGlobalPrefix('api');
  
  // Настраиваем CORS (Cross-Origin Resource Sharing)
  // Это механизм, который разрешает браузеру делать запросы фронтенда
  app.enableCors({
    origin: [
      'https://u40ta.booba.fvds.ru', // Домен PWA фронтенда
      'http://localhost:3000',        // Локальный фронтенд для разработки
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Разрешенные HTTP методы
    credentials: true, // Разрешить передачу куков и авторизационных заголовков
  });

  // Глобальная валидация входящих данных
  // ValidationPipe автоматически проверяет данные по правилам, которые мы задаем в DTO классах
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // Удаляет поля, которые не описаны в DTO
    forbidNonWhitelisted: true, // Возвращает ошибку, если есть лишние поля
    transform: true,        // Автоматически преобразует типы (строки в числа и т.д.)
  }));

  // Получаем порт из переменных окружения или используем дефолтный 3000
  // process.env.PORT - стандартный способ хранения настроек в Node.js
  const port = process.env.PORT ?? 3000;
  
  // Запускаем сервер и ждем пока он начнет слушать указанный порт
  await app.listen(port);
  
  // Логируем успешный запуск сервера
  logger.log(`Сервер успешно запущен на порту ${port}`);
  logger.log(`Время запуска: ${new Date().toLocaleString('ru-RU')}`);
}

// Запускаем наше приложение
// bootstrap() - это стандартное название для функции инициализации в NestJS
bootstrap();