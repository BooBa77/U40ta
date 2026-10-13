# Модуль объектов учёта (Objects)

## Назначение

Объект учёта — единица оргтехники или материальной ценности на складе. Модуль
хранит карточки объектов и собирает вокруг них связанные данные, QR-коды и
фотографии, в одной транзакции. Он же обслуживает офлайн-синхронизацию:
`OfflineService` вызывает `create`/`update` с внешним `EntityManager`.

## Файловая структура

```
objects/
├── README.md                 этот файл
├── objects.controller.ts     HTTP-маршруты
├── objects.module.ts         модуль NestJS
├── dto/                      create-object.dto.ts, update-object.dto.ts
├── entities/
│   └── object.entity.ts      сущность InventoryObject (таблица `objects`)
└── services/
    └── objects.service.ts    бизнес-логика
```

## Маршруты

Префикс — `/api`. Класс целиком guard'ом не закрыт: `JwtAuthGuard` стоит только
на `POST` и `PATCH`, чтение открыто; в `development` guard пропускает запросы.

| Метод | Путь | Что делает | Авторизация |
|---|---|---|---|
| `GET` | `/api/objects/by-inv?inv=&zavod=&sklad=&party=` | поиск по инвентарному номеру; пустые фильтры не применяются | нет |
| `GET` | `/api/objects/by-places?placeTer=&placePos=&placeCab=&placeUser=&excludeId=` | объекты с тем же местоположением — для поиска связанных при перемещении | нет |
| `GET` | `/api/objects/sklad-combinations` | уникальные пары завод + склад | нет |
| `GET` | `/api/objects/place-combinations` | уникальные комбинации территории, здания, кабинета, пользователя | нет |
| `GET` | `/api/objects/find-similar?docType=&invNumber=&partyNumber=&sn=` | поиск похожих объектов при синхронизации из офлайна | нет |
| `GET` | `/api/objects/sklad?zavod=&sklad=` | все объекты склада; `400`, если `zavod` не число или `sklad` пуст | нет |
| `GET` | `/api/objects/:id` | объект по id; `404`, если не найден | нет |
| `POST` | `/api/objects` | создание объекта вместе с QR-кодами и фото в одной транзакции | `JwtAuthGuard` |
| `PATCH` | `/api/objects/:id` | частичное обновление: поля, QR-коды, удаление и добавление фото | `JwtAuthGuard` |

`GET /:id` объявлен последним, иначе он перехватывал бы пути вроде `by-inv`.

## Ключевые методы сервиса

| Метод | Зачем |
|---|---|
| `findOne(id)` | объект по id, иначе `NotFoundException` |
| `findByInv(invNumber, zavod?, sklad?, partyNumber?)` | поиск по инвентарному номеру с необязательными фильтрами |
| `findBySklad(zavod, sklad)` | все объекты склада, сортировка по `invNumber` |
| `findByPlaces(ter, pos, cab, user, excludeId)` | объекты по местоположению; пустые значения сравниваются с `NULL` |
| `getSkladCombinations()` | `DISTINCT` завод + склад, пустые склады отброшены |
| `getPlaceCombinations()` | `DISTINCT` комбинации места; `placeTer` обязателен, остальное может быть `NULL` |
| `findSimilar(docType, invNumber, partyNumber?, sn?)` | для `ОС` — только `invNumber`, для `ОСВ` — ещё партия и серийный номер |
| `create(dto, userId, manager?)` | объект + QR + фото одной транзакцией |
| `update(id, dto, userId, manager?)` | правка полей, привязка QR, удаление и добавление фото |

## Сущность и DTO

Таблица `objects`: завод и склад, инвентарный номер, бухгалтерское
наименование, партия, серийный номер, местоположение (`place_ter`, `place_pos`,
`place_cab`, `place_user`), комментарий `rem`, флаг `is_written_off`, дата
`checked_at`. Частичный индекс `idx_objects_zavod_sklad_active` — по
`zavod, sklad` при `is_written_off = false`.

`CreateObjectDto`: обязательные `zavod`, `sklad`, `buhName`, `invNumber` плюс
`qrCodes` и `photosToAdd` (base64 `max`/`min`). `UpdateObjectDto`: все поля
необязательные, добавлены `photosToDelete`, `photosToUpdate` и `checkedAt`.

## Особенности

- **Модуль — точка сборки объекта:** `create`/`update` пишут объект, QR
  (`QrCodesService.save`) и фото (`PhotosService`) в одной транзакции; без
  переданного `manager` транзакция своя, офлайн-синхронизация передаёт внешний
  менеджер.
- **Смена склада обнуляет местоположение:** если `zavod` или `sklad` отличаются
  от текущих, `placeTer`, `placePos`, `placeCab`, `placeUser` сбрасываются в `NULL`.
- **`qrCodes` — не полная замена.** Комментарий обещает «новый полный набор», но
  сервис лишь вызывает `save` для пришедших значений, остальные QR остаются
  привязанными к объекту.
- **`photosToUpdate` не обрабатывается:** поле проходит валидацию DTO и приходит
  из офлайн-синхронизации, но сервис его не читает.
- **`isWrittenOff` всегда `false`:** его ставит только создание, а выборки
  списанные объекты не отфильтровывают; `checkedAt` при создании — `new Date()`,
  при `PATCH` — из `dto.checkedAt`.
- **Ошибки `POST`/`PATCH` уходят с кодом `200`** и телом `{ success: false, error }`:
  контроллер ловит исключения (включая `UnauthorizedException` и
  `NotFoundException`) внутри `try`.
- **Связи:** `AppEventsModule` (SSE `objects-changed` при создании и при смене
  склада), `JwtAuthModule`, `PhotosModule`, `QrCodesModule`; сервис
  экспортируется для `OfflineModule`.
