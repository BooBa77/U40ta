# Модуль логирования (Logs)

Система логирования обеспечивает централизованный сбор, хранение и анализ событий с бэкенда (NestJS) и фронтенда (Vue). Все логи сохраняются в единую таблицу PostgreSQL с гибкой JSONB-структурой для метаданных.

## Архитектура
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Vue Client │────▶│ NestJS API │────▶│ PostgreSQL │
│ │ │ │ │ │
│ useLogger() │ │ LogsController │ │ logs │
│ │ │ LogsService │ │ table │
└─────────────────┘ └─────────────────┘ └─────────────────┘
│ │
│ │
└───────┬───────────────┘
▼
┌─────────────────┐
│ Global Filters │
│ & Interceptors │
└─────────────────┘

## Структура

| Файл | Назначение |
|:---|:---|
| `logs.entity.ts` | Сущность TypeORM (таблица `logs`) |
| `logs.service.ts` | Сервис записи логов (fire-and-forget) |
| `logs.controller.ts` | API endpoint для фронтенда |
| `logs.module.ts` | Глобальный модуль NestJS |
| `index.ts` | Публичный экспорт |
| `src/composables/useLogger.ts` | Vue composable для фронтенда |

## Сущность Log (`logs.entity.ts`)

| Поле      | Тип           | Описание                                               |
| :-------- | :------------ | :----------------------------------------------------- |
| `id`      | `bigserial`   | Первичный ключ, автоинкремент                          |
| `source`  | `varchar(20)` | Источник: `'backend'` или `'frontend'`                 |
| `time`    | `timestamptz` | Время события, по умолчанию `NOW()`                    |
| `user_id` | `bigint`      | ID пользователя из JWT (поле `sub`), может быть `NULL` |
| `content` | `jsonb`       | Произвольные данные события в формате JSON             |

## API Endpoints

### POST `/api/logs`

Приём логов с фронтенда. Требует авторизации, защищён от спама (rate limiting).

**Защита**:  
- `JwtAuthGuard` — требуется авторизация (валидный JWT-токен).  
- `ThrottlerGuard` — ограничение частоты запросов.
**Примечания**:  
- Поле `source` всегда принудительно устанавливается в `'frontend'` — подмена невозможна.  
- `user_id` извлекается из JWT-токена (`req.user.sub`), если пользователь авторизован; иначе `null`.  
- Запись в БД выполняется асинхронно (fire-and-forget), ошибки логируются только в консоль приложения.

## Глобальные перехватчики и фильтры

### LoggerInterceptor (logger.interceptor.ts) и AllExceptionsFilter (all-exceptions.filter.ts)
Глобальный перехватчик и фильтр, автоматически логирующие каждый HTTP-запрос к бэкенду и все необработанные исключения в приложении
Зарегистрированы в **main.ts**:

  app.useGlobalInterceptors(new LoggerInterceptor(logsService));
  app.useGlobalFilters(new AllExceptionsFilter(logsService));

## Защита от спама (rate limiting)

Настроено в **app.module.ts**
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 минута
      limit: 10,   // 10 запросов за окно
    }]),
    LogsModule,
  ]
})

## Сервис логирования (logs.service.ts)

Основной сервис для записи логов. Использует fire-and-forget подход — не ждёт завершения операции записи в БД.

**Метод:**

typescript
log(source: string, userId: number | null, content: any): void

**Особенности:**

- Асинхронная запись через insert()
- Ошибки записи перехватываются и логируются в консоль приложения
- Не выбрасывает исключений, не блокирует основное приложение

**Использование в сервисах**
Для ручного логирования бизнес-событий в любом сервисе:

import { Injectable } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class SomeService {
  constructor(private readonly logsService: LogsService) {}

  async doSomething(userId: number) {
    this.logsService.log('backend', userId, {
      action: 'some_action',
      result: 'success',
      details: { /* любые данные */ }
    });
  }
}


# Фронтенд
## Компосабл `useLogger`

Для отправки логов с фронтенда используется компосабл `src/composables/useLogger.ts`. Он предоставляет метод `log(content)`, который асинхронно отправляет POST-запрос на `/api/logs` с авторизацией через токен JWT. В случае неудачи ошибка логируется в консоль, но не прерывает выполнение основного кода приложения, что гарантирует, что логирование не повлияет на работу.

**Использование в сервисах/компонентах**:
```typescript
const { log } = useLogger();
await log({ action: 'button_click', page: 'dashboard' });