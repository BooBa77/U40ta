# Модуль фотографий (Photos)

## Назначение

Фотографии объектов: полноразмерный снимок и миниатюра. Оба лежат прямо в базе
(`bytea`), на диск ничего не пишется. Модуль отдаёт список фото объекта и сами
картинки, а принимает их двумя путями: одиночным multipart-запросом и готовыми
буферами — из формы объекта и офлайн-синхронизации.

## Файловая структура

```
photos/
├── README.md                этот файл
├── photos.controller.ts     HTTP-маршруты
├── photos.module.ts         модуль NestJS
├── photos.service.ts        бизнес-логика
├── dto/
│   └── create-photo.dto.ts  objectId; контроллером не используется
└── entities/
    └── photos.entity.ts     сущность Photo (таблица `photos`)
```

## Маршруты

Префикс — `/api`. `JwtAuthGuard` висит на всём контроллере, включая выдачу
картинок: фронтенд качает их `fetch`'ем с заголовком `Authorization`. В режиме
`development` guard пропускает запросы.

| Метод | Путь | Что делает | Авторизация |
|---|---|---|---|
| `POST` | `/api/photos?objectId=...` | загрузка одного фото, поле формы `photo` | `JwtAuthGuard` |
| `GET` | `/api/photos/object/:objectId` | список фото объекта: `id`, `objectId`, `url`, `thumbUrl` | `JwtAuthGuard` |
| `GET` | `/api/photos/:id` | полноразмерное фото (`photo_max_data`), `image/jpeg` | `JwtAuthGuard` |
| `GET` | `/api/photos/:id/thumbnail` | миниатюра (`photo_min_data`), `image/jpeg` | `JwtAuthGuard` |
| `DELETE` | `/api/photos/:id` | удалить фото, `204 No Content` | `JwtAuthGuard` |

`objectId` приходит не телом, а query-параметром (`ParseIntPipe`); сам файл
берёт `FileInterceptor('photo')`. Пути `url`/`thumbUrl` в списке формирует
контроллер.

## Ключевые методы сервиса

| Метод | Зачем |
|---|---|
| `findOne(id, manager?)` | фото по id целиком, вместе с бинарными данными; иначе `NotFoundException` |
| `findAllByObject(objectId, manager?)` | фото объекта, новые сверху (`createdAt DESC`) |
| `createFromBuffers(objectId, max, min, userId, manager?)` | фото из готовых буферов — путь формы объекта и офлайн-синхронизации |
| `createFromFile(objectId, file, userId, manager?)` | фото из Multer-файла, маршрут `POST /api/photos` |
| `attachToObject(photoId, objectId, manager?)` | перепривязать фото другому объекту |
| `remove(id, manager?)` | удалить фото; `404`, если строки нет |

## Особенности

- **Сущность.** Таблица `photos`: `id` (bigint), `photo_max_data` и
  `photo_min_data` (`bytea`, `NOT NULL`), `object_id` (bigint, `NOT NULL`),
  `created_by` (bigint, nullable), `created_at` (`timestamp with time zone`,
  по умолчанию `now()`), индекс `idx_photos_object_id`. Внешний ключ на
  `objects` в сущности не объявлен.
- **Фото живут в базе, а не на диске:** значит, снимки объектов попадают и в
  дамп базы.
- **`createFromFile` кладёт один и тот же буфер и в `max`, и в `min`** —
  миниатюра получается равной полноразмерному фото; ресайза на бэке нет, по
  комментарию в коде фронт должен присылать уже оптимизированную картинку.
  Фронтенд при этом добавляет в форму ещё и поле `thumbnail`, которое
  `FileInterceptor('photo')` не читает.
- **`Content-Type: image/jpeg` выставляется всегда**, независимо от того, что
  реально лежит в `bytea`.
- **`findOne` достаёт строку целиком**, поэтому отдача миниатюры тянет из базы и
  полноразмерные данные.
- **`manager?` есть во всех методах, но используется не везде:** `ObjectsService`
  и `OfflineService` передают менеджер и пишут фото внутри своих транзакций, а
  `ProposedChangesService` создаёт фото-заготовку без менеджера и с `object_id = 0`,
  а при утверждении предложения перепривязывает её через `attachToObject`.
- **`CreatePhotoDto` не используется** — маршрут загрузки берёт `objectId` из
  query, а файл из multipart.
- **Связи:** экспортирует `PhotosService` для `ObjectsModule` и
  `ProposedChangesModule`.
