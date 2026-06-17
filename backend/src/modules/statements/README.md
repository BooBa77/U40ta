# Модуль Statements (Ведомости МОЛ)

Модуль для обработки ведомостей МОЛ из Excel-файлов, полученных по email. Ведомости парсятся сразу при получении письма и сохраняются в БД.

## Структура модуля
statements/
├── dto/
│ ├── parsed-osv-excel-row.dto.ts # Типизация строк Excel ОСВ
│ ├── parsed-os-excel-row.dto.ts # Типизация строк Excel ОС
│ └── update-actual.dto.ts # DTO для обновления isActual
├── entities/
│ └── statement.entity.ts # Сущность Statement
├── services/
│ ├── statements.service.ts # Основной сервис
│ └── statement-parser.service.ts # Парсинг Excel
├── statements.controller.ts
└── statements.module.ts


## Поток данных

1. Письмо от МОЛ приходит на почтовый ящик
2. `ImapService` забирает письмо, извлекает Excel-вложение
3. `EmailProcessor` анализирует файл через `EmailFileAnalyzer` и определяет, что это обычная ведомость (тема письма не содержит "инвентар")
4. `EmailProcessor` находит пользователя по email отправителя и эмитит событие `statement.file.received` с Buffer, userId, docType и description
5. `StatementParser` слушает событие, парсит Excel из Buffer и сохраняет строки в таблицу `statements`
6. Фронтенд запрашивает `GET /api/statements` — список ведомостей
7. Фронтенд запрашивает `GET /api/statements/items?receivedAt=...` — строки ведомости с динамическим `objectCount`

## Сущность Statement

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `bigint` | Первичный ключ |
| `userId` | `integer` | ID пользователя-владельца (МОЛ) |
| `receivedAt` | `timestamp` | Дата и время получения письма |
| `docType` | `varchar(10)` | Тип документа: ОСВ или ОС |
| `description` | `varchar(500)` | Описание, например "ОСВ s010,s017" |
| `zavod` | `integer` | Номер завода. Для ОС всегда 0 |
| `sklad` | `varchar(8)` | Код склада |
| `invNumber` | `varchar(255)` | Инвентарный номер |
| `partyNumber` | `varchar(255)` | Номер партии |
| `buhName` | `text` | Бухгалтерское наименование |
| `isActual` | `boolean` | Флаг актуальности (управляется пользователем) |

## Логика работы

1. **Получение ведомости**: Excel-файл парсится сразу при получении письма. Строки сохраняются в `statements`. Файл на диск не сохраняется.
2. **Группировка ведомостей**: строки группируются по `userId + receivedAt + description`. Одно письмо = одна ведомость.
3. **Динамический `objectCount`**: при запросе строк ведомости бэк JOIN'ит таблицу `objects` и для каждой строки вычисляет количество реальных объектов с теми же `zavod + sklad + invNumber + partyNumber`.
4. **`isExcess`**: вычисляется на фронте. Для каждого склада ведомости запрашиваются все объекты. Если объектов больше чем строк statements — создаются виртуальные синие строки. В БД не хранятся.
5. **`haveObject`**: не хранится в БД, вычисляется динамически через `objectCount > 0`.
6. **`isActual`**: единственный сохраняемый флаг. Управляется пользователем через чекбокс. Влияет на группировку: неактуальные строки группируются только по `invNumber`.

## Эндпоинты API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/statements` | Список ведомостей МОЛ (группировка по `receivedAt + description`) |
| `GET` | `/api/statements/items?receivedAt=...` | Строки ведомости с динамическим `objectCount` |
| `DELETE` | `/api/statements?receivedAt=...` | Удаление ведомости |
| `GET` | `/api/statements/by-inv?inv=&zavod=&sklad=&party=` | Поиск записей по инвентарному номеру |
| `POST` | `/api/statements/update-actual` | Обновление `isActual` для группы строк |

## Парсинг Excel

- **ОСВ**: колонки `Завод`, `Склад`, `КрТекстМатериала`, `Материал`, `Партия`, `Запас на конец периода`. Значение в колонке `Запас на конец периода` определяет количество создаваемых записей.
- **ОС**: колонки `Основное средство`, `Название`, `Инвентарный номер`, `МОЛ`. `zavod = 0`, `partyNumber = null`.
- Пропускаются строки без инвентарного номера (итоговые строки).
- `description` формируется `EmailFileAnalyzer` при анализе файла: собираются уникальные склады из всех строк.

## Интеграция с EmailModule

Модуль statements не зависит от EmailModule напрямую. Связь через EventEmitter:

1. `EmailProcessor` эмитит событие `statement.file.received` с данными:
   - `buffer` — содержимое Excel-файла
   - `filename` — оригинальное имя файла
   - `userId` — ID пользователя-владельца
   - `docType` — тип документа (ОСВ или ОС)
   - `description` — описание ведомости

2. `StatementParser` слушает это событие и парсит строки в таблицу `statements`.

## DTO

- **`UpdateActualDto`** — для обновления `isActual`. Поля: `receivedAt`, `invNumber`, `isActual`.
- **`ParsedOSVExcelRowDto`** и **`ParsedOSExcelRowDto`** — типизация строк Excel для парсера.

## Индексы

| Индекс | Поля | Назначение |
|--------|------|------------|
| `idx_statements_user_received` | `user_id, received_at DESC` | Список ведомостей, строки ведомости |
| `idx_statements_have_object` | `inv_number` WHERE `have_object = false` | Не используется (haveObject динамический), будет удалён |

## Особенности

- Каждый МОЛ видит только свои ведомости (фильтрация по `userId` из JWT)
- Несколько складов в одной ведомости — норма (description содержит все склады)
- Файлы не сохраняются на диск
- Понятия "активной ведомости" больше нет — все ведомости независимы

### SSE уведомления

- `objects-changed` — отправляется при создании или обновлении объекта на складе. StatementPage делает reload(), если ведомость содержит этот склад. Свои изменения игнорируются (userId совпадает).