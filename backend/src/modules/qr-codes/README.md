# Модуль QR-кодов (QrCodes)

## Назначение

Связь отсканированного QR-значения с объектом учёта: по коду находится объект,
по объекту — код. Значение QR уникально и работает как естественный ключ, поэтому
повторная привязка того же кода к другому объекту — это переназначение, а не
создание второй записи.

## Файловая структура

```
qr-codes/
├── README.md                       этот файл
├── qr-codes.controller.ts          HTTP-маршруты
├── qr-codes.module.ts              модуль NestJS
├── qr-codes.service.ts             бизнес-логика
├── dto/
│   ├── create-qr-code.dto.ts       qrValue + objectId
│   └── update-qr-owner.dto.ts      qrValue + newObjectId
├── entities/
│   └── qr-code.entity.ts           сущность QrCode (таблица `qr_codes`)
└── interfaces/
    └── qr-scan-result.interface.ts форма ответа сканирования
```

## Маршруты

Префикс — `/api`. `JwtAuthGuard` стоит на `POST` и `PUT`; сканирование открыто.
В режиме `development` guard пропускает запросы.

| Метод | Путь | Что делает | Авторизация |
|---|---|---|---|
| `GET` | `/api/qr-codes/scan?qr=...` | найти объект по значению QR | нет |
| `POST` | `/api/qr-codes` | создать QR или перепривязать существующий | `JwtAuthGuard` |
| `PUT` | `/api/qr-codes/update-owner` | переназначить QR другому объекту | `JwtAuthGuard` |

Ответ сканирования — `QrScanResult`: `{ success, qrValue, objectId?, object?: { invNumber, buhName }, error? }`.
Ненайденный код возвращается как `success: false` с кодом `200`, а не `404`.

## Ключевые методы сервиса

| Метод | Зачем |
|---|---|
| `findObjectByQr(qrValue)` | поиск кода с подгрузкой объекта (`relations: ['object']`) |
| `save(qrValue, objectId, manager?)` | upsert: `findOne` по `qrValue`, затем перепривязка или создание |
| `create(dto)` | обёртка над `save` |
| `updateOwner(dto)` | обёртка над `save`, всегда возвращает `{ success: true }` |

## Особенности

- **Сущность.** Таблица `qr_codes`: `id` (bigint), `qr_value` (varchar(255),
  уникальный индекс `qr_codes_qr_value_key`), `object_id` (bigint, nullable) и
  связь `object` — `ManyToOne` на `InventoryObject` с `onDelete: 'SET NULL'`.
- **Оба «создающих» метода — один и тот же upsert.** `create` и `updateOwner`
  помечены в коде как оставленные «для обратной совместимости», различаются
  только именем поля (`objectId` / `newObjectId`).
- **Код может быть без владельца:** при `object_id = NULL` сканирование вернёт
  `success: true` и пустой `objectId`.
- **Удаления и списка в модуле нет.** Контроллер умеет только сканировать,
  создавать и переназначать; запись исчезает вместе с объектом, и то не
  удалением, а обнулением `object_id` (`ON DELETE SET NULL`).
- **`save` принимает `EntityManager`** — `ObjectsService` вызывает его внутри
  своей транзакции, поэтому QR сохраняется вместе с объектом.
- **Проверки существования объекта нет:** `objectId` валидируется только как
  `@IsInt`, целостность обеспечивает внешний ключ `qr_codes_object_id_fkey`.
- **Скан без авторизации:** само значение QR и есть пропуск, на этом построен
  переход по ссылке `/scan/:qrCode`.
- **Связи:** экспортирует `QrCodesService` для `ObjectsModule` и
  `ProposedChangesModule`; сам импортирует только `JwtAuthModule` ради guard'а.
