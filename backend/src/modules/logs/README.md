# Модуль логирования (Logs)

Система логирования обеспечивает централизованный сбор, хранение и анализ событий с бэкенда (NestJS) и фронтенда (Vue). Все логи сохраняются в единую таблицу PostgreSQL с гибкой JSONB-структурой для метаданных.

## Архитектура

    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │   Vue Client    │────▶│   NestJS API   │────▶│   PostgreSQL    │
    │                 │     │                 │     │                 │
    │  useLogger()    │     │ LogsController  │     │     logs        │
    │                 │     │  LogsService    │     │     table       │
    └─────────────────┘     └─────────────────┘     └─────────────────┘
                                       │
                                       │
                             ┌─────────▼─────────┐
                             │  Global Filters   │
                             │  & Interceptors   │
                             └───────────────────┘

## Структура модуля

| Файл | Назначение |
|:---|:---|
| logs.entity.ts | Сущность TypeORM (таблица logs) |
| logs.service.ts | Сервис записи логов (fire-and-forget) |
| logs.controller.ts | API endpoints для фронтенда и бизнес-логов |
| logs.module.ts | Глобальный модуль NestJS |
| dto/object-history.dto.ts | DTO для логирования истории объектов |
| dto/qr-code-history.dto.ts | DTO для логирования истории QR-кодов |
| index.ts | Публичный экспорт модуля |

## Сущность Log (logs.entity.ts)

| Поле | Тип | Описание |
|:---|:---|:---|
| id | bigserial | Первичный ключ, автоинкремент |
| source | varchar(20) | Источник: frontend, backend, object_history, qr_code_history |
| time | timestamptz | Время события, по умолчанию NOW() |
| user_id | bigint | ID пользователя из JWT (поле sub), может быть NULL |
| content | jsonb | Произвольные данные события в формате JSON |

### Возможные значения source:

| Значение | Описание |
|:---|:---|
| frontend | Логи с клиентской части (Vue), принудительно устанавливается контроллером |
| backend | Системные и бизнес-логи с бэкенда |
| object_history | История изменений объектов (создание, перемещение, списание и т.д.) |
| qr_code_history | История привязки/отвязки QR-кодов к объектам |

## API Endpoints

### POST /api/logs

**Назначение**: Приём логов с фронтенда.

**Защита**:
- JwtAuthGuard — требуется авторизация
- ThrottlerGuard — ограничение частоты запросов (10 запросов/минута)

**Тело запроса**:

    {
      "content": {
        "action": "button_click",
        "page": "dashboard",
        "metadata": {}
      }
    }

**Особенности**:
- source всегда принудительно frontend — подмена невозможна
- user_id извлекается из JWT-токена (req.user.sub)
- Запись в БД выполняется асинхронно (fire-and-forget)

**Ответ**:

    {
      "success": true
    }

### POST /api/logs/object-history

**Назначение**: Логирование событий жизненного цикла объекта.

**Защита**: JwtAuthGuard — требуется авторизация.

**Тело запроса**:

    {
      "objectId": 123,
      "eventType": "created",
      "storyLine": "Новый объект создан пользователем Иванов"
    }

**DTO валидация** (ObjectHistoryDto):
- objectId — integer, обязательный
- eventType — string, обязательный (например: created, moved, written_off, qr_attached, тип события для группировки событий)
- storyLine — string, обязательный (человекочитаемое описание события)

**Что пишется в лог**:

    {
      "source": "object_history",
      "content": {
        "object_id": 123,
        "event_type": "created",
        "story_line": "Новый объект создан пользователем Иванов"
      }
    }

### POST /api/logs/qr-code-history

**Назначение**: Логирование операций с QR-кодами (привязка, отвязка, перенос на другой объект).

**Защита**: JwtAuthGuard — требуется авторизация.

**Тело запроса**:

    {
      "qrCodeValue": "QR-ABC123",
      "objectId": 200
    }

**DTO валидация** (QrCodeHistoryDto):
- qrCodeValue — string, обязательный (значение QR-кода)
- objectId — integer, обязательный (ID объекта, на который повешен QR-код)

**Что пишется в лог**:

    {
      "source": "qr_code_history",
      "content": {
        "qr_code_value": "QR-ABC123",
        "object_id": 200
      }
    }

## Сервис логирования (logs.service.ts)

Основной сервис для записи логов. Использует fire-and-forget подход — не ждёт завершения операции записи в БД и не блокирует основной поток.

### Метод log()

    log(source: string, userId: number | null, content: any): void

**Параметры**:
- source — источник лога (см. возможные значения выше)
- userId — ID пользователя (может быть null для неавторизованных действий)
- content — объект с данными, сериализуется в JSONB

**Особенности**:
- Асинхронная запись через insert() без await
- Ошибки записи перехватываются и логируются в консоль приложения
- Не выбрасывает исключений наружу — гарантирует, что логирование не сломает основной функционал
- Не гарантирует запись в БД (fire-and-forget) — не использовать для критичных данных

**Использование в сервисах**:

    import { Injectable } from '@nestjs/common';
    import { LogsService } from '../logs/logs.service';
    
    @Injectable()
    export class ObjectService {
      constructor(private readonly logsService: LogsService) {}
    
      async createObject(userId: number, data: any) {
        const newObject = await this.objectRepository.save(data);
        
        this.logsService.log('backend', userId, {
          action: 'object_created',
          object_id: newObject.id,
          result: 'success'
        });
        
        return newObject;
      }
    }

## Глобальные перехватчики и фильтры

### LoggerInterceptor (logger.interceptor.ts)

Автоматически логирует каждый HTTP-запрос к бэкенду:
- Метод и URL запроса
- Время обработки запроса
- Статус ответа (успех/ошибка)
- Срабатывает ДО и ПОСЛЕ обработки запроса контроллером

### AllExceptionsFilter (all-exceptions.filter.ts)

Логирует все необработанные исключения в приложении:
- Сообщение ошибки
- Стек-трейс (только в development)
- Контекст запроса (URL, метод, параметры)
- Всегда возвращает клиенту структурированный ответ с ошибкой

**Регистрация в main.ts**:

    const logsService = app.get(LogsService);
    app.useGlobalInterceptors(new LoggerInterceptor(logsService));
    app.useGlobalFilters(new AllExceptionsFilter(logsService));

## Защита от спама (Rate Limiting)

Настроено в app.module.ts:

    import { ThrottlerModule } from '@nestjs/throttler';
    
    @Module({
      imports: [
        ThrottlerModule.forRoot([{
          ttl: 60000,
          limit: 10,
        }]),
        LogsModule,
      ]
    })

Применяется через @UseGuards(ThrottlerGuard) на эндпоинте /api/logs. При превышении лимита возвращается HTTP 429 (Too Many Requests).

## Фронтенд

### Компосабл useLogger (требует реализации)

Для отправки логов с фронтенда используется компосабл src/composables/useLogger.ts. Он должен предоставлять:

    const { log } = useLogger();
    
    await log({ 
      action: 'button_click', 
      page: 'dashboard' 
    });

**Требования к реализации**:
- Отправка POST-запроса на /api/logs с авторизацией через JWT-токен
- Автоматическое извлечение токена из хранилища (localStorage/cookies)
- Обработка ошибок — логирование в консоль, без прерывания основного кода
- Неблокирующая отправка (async/await или fire-and-forget)

**Особенности**:
- Поле source устанавливается бэкендом принудительно в frontend
- user_id берётся из JWT-токена, не нужно передавать явно
- Ошибки отправки не влияют на работу приложения