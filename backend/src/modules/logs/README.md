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
| dto/photo-history.dto.ts | DTO для логирования истории фотографий |
| index.ts | Публичный экспорт модуля |

## Сущность Log (logs.entity.ts)

| Поле | Тип | Описание |
|:---|:---|:---|
| id | bigserial | Первичный ключ, автоинкремент |
| source | varchar(20) | Источник: frontend, object-history, qr-code-history, photo-history, offline_mode |
| time | timestamptz | Время события, по умолчанию NOW() |
| user_id | bigint | ID пользователя из JWT (поле sub), может быть NULL |
| content | jsonb | Произвольные данные события в формате JSON |

### Возможные значения source:

Разделитель в составных значениях — **дефис**, не подчёркивание: по строке
`object-history` идёт и запись, и выборка истории объекта.

| Значение | Кто пишет |
|:---|:---|
| `frontend` | `POST /api/logs` — контроллер принудительно ставит этот источник |
| `object-history` | `POST /api/logs/object-history` и реплей офлайн-логов |
| `qr-code-history` | `POST /api/logs/qr-code-history` |
| `photo-history` | `POST /api/logs/photo-history` |
| `offline_mode` | `offline.service.ts` — вход в офлайн-режим и ошибки синхронизации |
| `backend` | зарезервирован в JSDoc сервиса, но ни одна точка в коде его пока не пишет |

## API Endpoints

### POST /api/logs

**Назначение**: Приём логов с фронтенда.

**Защита**:
- JwtAuthGuard — требуется авторизация
- ThrottlerGuard — ограничение частоты запросов (50 запросов/минута)

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
      "source": "object-history",
      "content": {
        "object_id": 123,
        "event_type": "created",
        "story_line": "Новый объект создан пользователем Иванов"
      }
    }

### GET /api/logs/object-history/:objectId

**Назначение**: чтение истории изменений объекта для вкладки «История» в карточке.

**Защита**: JwtAuthGuard — требуется авторизация.

**Ответ**:

    {
      "success": true,
      "history": [
        {
          "id": 15,
          "time": "2026-10-12T05:31:00.000Z",
          "eventType": "created",
          "storyLine": "Новый объект создан пользователем Иванов",
          "userAbr": "ИИ"
        }
      ]
    }

Записи берутся только с `source = 'object-history'`, сортируются по времени
возрастанию, аббревиатуры авторов подтягиваются из `users`.

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
      "source": "qr-code-history",
      "content": {
        "qr_code_value": "QR-ABC123",
        "object_id": 200
      }
    }

### POST /api/logs/photo-history

**Назначение**: Логирование истории фотографий объекта.

**Защита**: JwtAuthGuard — требуется авторизация.

**Тело запроса**:

    {
      "objectId": 200,
      "photoId": 42
    }

**DTO валидация** (PhotoHistoryDto):
- objectId — integer, обязательный
- photoId — integer, обязательный

**Что пишется в лог**:

    {
      "source": "photo-history",
      "content": {
        "object_id": 200,
        "photo_id": 42
      }
    }

## Сервис логирования (logs.service.ts)

Основной сервис для записи логов. Использует fire-and-forget подход — не ждёт завершения операции записи в БД и не блокирует основной поток.

### Метод log()

    log(source: string, userId: number | null, content: any, time?: Date): void

**Параметры**:
- source — источник лога (см. возможные значения выше)
- userId — ID пользователя (может быть null для неавторизованных действий)
- content — объект с данными, сериализуется в JSONB
- time — необязательное время события; передаётся при реплее офлайн-логов
  (`offline-sync.service.ts`), чтобы сохранить исходную метку, иначе БД ставит
  `NOW()`

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

### Метод getObjectHistory()

    getObjectHistory(objectId: number): Promise<Array<{
      id: number; time: Date; eventType: string; storyLine: string; userAbr: string | null;
    }>>

Читает записи `object-history` по `content->>'object_id'`, сортирует по времени
возрастанию и подтягивает аббревиатуры авторов. Пользователей берёт запросом
через `repository.manager`, а не через `UsersService`, — чтобы не заводить
циклическую зависимость `logs` ↔ `users`.

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
          limit: 50,
        }]),
        LogsModule,
      ]
    })

Применяется через @UseGuards(ThrottlerGuard) на эндпоинте /api/logs. При превышении лимита возвращается HTTP 429 (Too Many Requests).

## Фронтенд

Бизнес-историю пишет `frontend/src/services/logs.service.js`: он отправляет записи
на `/api/logs/object-history`, `/api/logs/qr-code-history` и
`/api/logs/inventory-history`, а читает через `GET /api/logs/<вид>-history/:id`.
Вызовы стоят там, где меняется объект, — их и показывает вкладка «История» в
карточке объекта.

Два расхождения, о которых стоит знать при чтении этого сервиса:

* `inventory-history` и `GET /api/logs/qr-code-history/:value` фронтенд вызывает,
  но в контроллере таких маршрутов нет — сейчас они дают `404`;
* `photo-history` наоборот: маршрут `POST /api/logs/photo-history` есть, а метода
  в `logs.service.js` нет; источник `photo-history` фронтенд разбирает только при
  офлайн-синхронизации.

Компосабл `frontend/src/composables/useLogger.ts` удалён 12.10.2026 вместе с
отправкой технических логов в базу: ошибки фронтенда идут в консоль браузера.