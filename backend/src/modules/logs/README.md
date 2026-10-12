# Модуль логирования (Logs)

Здесь хранится **бизнес-история**: изменения объекта, QR-кода и фотографии. Записи пишет фронтенд (Vue) через `POST /api/logs/*`, читает обратно через `GET /api/logs/object-history/:objectId`. Всё лежит в одной таблице PostgreSQL с JSONB-полем для метаданных.

Технических логов здесь больше нет. До 12.10.2026 в эту же таблицу писалась строка на каждый HTTP-запрос и диагностика разбора почты; читать их было некому, а таблица росла от каждой нагрузки. Теперь техническая диагностика идёт в консольный лог процесса — смотрим через `docker compose logs`.

## Архитектура

    ┌───────────────────────┐     ┌──────────────────┐     ┌──────────────┐
    │ Vue Client            │────▶│ NestJS API       │────▶│ PostgreSQL   │
    │                       │     │                  │     │              │
    │ services/             │     │ LogsController   │     │    logs      │
    │   logs.service.js     │     │ LogsService      │     │    table     │
    └───────────────────────┘     └──────────────────┘     └──────────────┘
       пишет историю объекта         POST /api/logs/*        только
       и QR-кода, читает её          GET  /api/logs/...      бизнес-история

## Структура модуля

| Файл | Назначение |
|:---|:---|
| logs.entity.ts | Сущность TypeORM (таблица logs) |
| logs.service.ts | Запись бизнес-истории (fire-and-forget) и чтение истории объекта |
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

## Технические логи — в консоль, а не в базу

Раньше на каждый HTTP-запрос в таблицу `logs` писалась строка
(`LoggerInterceptor`), туда же уходили необработанные исключения
(`AllExceptionsFilter`), а копившееся подчищал `clean-logs.sh` по cron. Читать
эти записи было некому, а таблица росла от каждой нагрузки.

С 12.10.2026 техническая диагностика идёт **в консольный лог процесса**:

* `AllExceptionsFilter` (`common/filters/all-exceptions.filter.ts`) приводит сбой
  к единому формату ответа и пишет его в консоль — в базу больше не пишет;
* перехватчик запросов (`logger.interceptor.ts`) удалён совсем;
* диагностика разбора почты и ведомостей переведена на `Logger` NestJS.

В таблице остаётся только бизнес-история: `object-history`, `qr-code-history`,
`photo-history` и `offline_mode`.

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

Бизнес-историю пишет `frontend/src/services/logs.service.js`: он отправляет записи
на `/api/logs/object-history`, `/api/logs/qr-code-history` и
`/api/logs/photo-history`, а читает через `GET /api/logs/<вид>-history/:id`.
Вызовы стоят там, где меняется объект, — их и показывает вкладка «История» в
карточке объекта.

Компосабл `frontend/src/composables/useLogger.ts` удалён 12.10.2026 вместе с
отправкой технических логов в базу: ошибки фронтенда идут в консоль браузера.