# Модуль Statements (Ведомости)

Модуль для обработки ведомостей из Excel файлов (вложений email).

## Структура модуля
statements/
├── dto/
│ ├── parsed-excel-row.dto.ts # Типизация строк Excel
│ ├── statement-response.dto.ts # DTO ответов API
│ ├── update-ignore.dto.ts # DTO для обновления is_ignore
│ └── update-have-object.dto.ts # DTO для обновления have_object (только statementId)
├── entities/
│ └── processed-statement.entity.ts # Сущность ProcessedStatement
├── services/
│ ├── statement.service.ts # Главный сервис
│ ├── statement-parser.service.ts # Парсинг Excel
│ └── statement-objects.service.ts # Работа с флагами have_object и is_excess
├── statements.controller.ts
└── statements.module.ts


## Поток данных (Data Flow)

1. Запрос от клиента: `GET /api/statements/:attachmentId`
2. Контроллер (`StatementsController`): принимает числовой `attachmentId` через `ParseIntPipe`
3. Главный сервис (`StatementService`): проверяет вложение, определяет состояние ведомости (inProcess)
4. Парсер (`StatementParserService`): читает Excel → `ParsedOSVExcelRowDto[]` или `ParsedOSExcelRowDto[]`, создаёт Entity → `ProcessedStatement[]`, сохраняет в БД в транзакции, преобразует в `ProcessedStatementDto[]`
5. Ответ клиенту: `StatementResponseDto { success, attachmentId, statements: ProcessedStatementDto[], count, message?, error? }`

## Логика работы

1. **Первое открытие ведомости**: парсится Excel, создаются записи в БД, затем вызывается `StatementObjectsService.updateHaveObjectsForStatement()` для вычисления флагов `have_object` и создания записей `is_excess`
2. **Повторное открытие**: если `inProcess = true`, сразу возвращаются существующие записи без повторного парсинга
3. **Активная ведомость**: ведомость помечается как "в работе" (`inProcess = true`). При открытии новой ведомости для того же склада/типа старая помечается `inProcess = false`, а её записи удаляются
4. **Обновление флагов**: при изменении `is_ignore` или создании объекта фоново вызывается `updateHaveObjectsForStatement()`, который пересчитывает `have_object` и `is_excess` для всей ведомости
5. **SSE уведомления**: при изменении ведомости отправляются события `statement-updated` и `statement-active-changed` для обновления интерфейса в реальном времени

## DTO и их назначение

### Используемые DTO

- **`ProcessedStatementDto`** — основной DTO для передачи записей ведомости на фронтенд. Содержит все поля сущности без связей. Методы `fromEntity()` и `fromEntities()` для преобразования.
- **`StatementResponseDto`** — обёртка ответа API, содержит массив `ProcessedStatementDto[]`, статус успеха, количество записей и сообщение об ошибке.
- **`UpdateIgnoreDto`** — для обновления флага `is_ignore` у группы строк. Используется в `POST /api/statements/ignore`.
- **`UpdateHaveObjectDto`** — для обновления флага `have_object` у конкретной записи. Содержит только `statementId`. Используется в `POST /api/statements/update-have-object`.
- **`ParsedOSVExcelRowDto`** и **`ParsedOSExcelRowDto`** — типизация строк Excel для парсера.

## Флаги записей

| Флаг | Описание |
|------|----------|
| `have_object` | Есть ли реальный объект в системе для этой строки ведомости. Автоматически пересчитывается при изменении объектов или ведомости. |
| `is_excess` | Объект есть в системе, но отсутствует в ведомости. Создаётся автоматически при пересчёте флагов. Пользователь не может менять вручную. |
| `is_ignore` | Флаг игнорирования строки. Может быть изменён пользователем через чекбокс в таблице. Влияет на группировку и отображение. |

## Эндпоинты API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/statements/:attachmentId` | Открытие/обработка ведомости по ID вложения. Возвращает `StatementResponseDto`. |
| `GET` | `/api/statements/by-inv` | Поиск записей ведомости по инвентарному номеру. Возвращает только записи с `have_object = false`. Формат ответа: `{ success, statements: ProcessedStatementDto[], count, error? }`. |
| `POST` | `/api/statements/ignore` | Обновление статуса `is_ignore` для группы строк. Принимает `UpdateIgnoreDto`. Возвращает `StatementResponseDto`. |
| `POST` | `/api/statements/update-have-object` | Обновление статуса `have_object` для конкретной записи. Принимает `UpdateHaveObjectDto`. Возвращает `204 No Content`. |

## Важные детали реализации

### Парсинг Excel

- **ОСВ**: читаются колонки `Завод`, `Склад`, `КрТекстМатериала`, `Материал`, `Партия`, `Запас на конец периода`. Если значение в колонке `Запас на конец периода` больше 1, создаётся соответствующее количество записей.
- **ОС**: читаются колонки `Основное средство`, `Название`, `Инвентарный номер`, `МОЛ`. Партия устанавливается в `'-'`.
- Пропускаются строки без инвентарного номера (итоговые строки).

### Транзакции

- Подготовка новой ведомости (`prepareForNewStatement`) и сохранение записей (`saveStatementsInTransaction`) выполняются в отдельных транзакциях.
- При подготовке удаляются все старые записи для данного склада и типа документа, сбрасывается флаг `inProcess` у предыдущей активной ведомости.
- При сохранении новые записи создаются, и текущей ведомости устанавливается `inProcess = true`.

### Пересчёт флагов (`StatementObjectsService.updateHaveObjectsForStatement`)

1. Находит активную ведомость для данного склада и типа документа.
2. Удаляет все старые записи с `is_excess = true` для этой ведомости.
3. Получает все объекты на складе, группирует по ключу `завод|инв_номер|партия`.
4. Для каждой записи ведомости (кроме `is_excess`) проверяет наличие объекта:
   - Если объект есть → `have_object = true`, объект "тратится" (уменьшается счётчик).
   - Если объекта нет → `have_object = false`.
5. Сохраняет обновлённые записи.
6. Для оставшихся объектов (которые есть в системе, но отсутствуют в ведомости) создаёт записи с `is_excess = true`.

### SSE уведомления

- `notifyStatementUpdated(statementId)` — отправляется после изменения конкретной записи (например, после создания объекта).
- `notifyStatementActiveChanged(attachmentId, zavod, sklad)` — отправляется после успешного парсинга ведомости, уведомляет о смене активной ведомости на складе.
- Фронтенд подписывается на эти события через `EventSource` и перезагружает данные или перенаправляет пользователя при необходимости.

## Как добавить новый эндпоинт

1. Создать DTO для запроса (если нужен) в папке `dto/`.
2. Добавить метод в `statements.controller.ts` с декораторами `@Get()`, `@Post()` и т.д.
3. Реализовать бизнес-логику в соответствующем сервисе (`StatementService`, `StatementParserService` или `StatementObjectsService`).
4. Для ответов использовать `ProcessedStatementDto.fromEntities()` для преобразования сущностей.
5. Возвращать `StatementResponseDto` или прямой массив DTO в зависимости от задачи.

## Особенности и ограничения

- Поддерживаются только типы документов `ОСВ` и `ОС`.
- Файлы должны находиться в директории `../email-attachments/` относительно корня проекта.
- При повторном открытии ведомости флаги `have_object` и `is_excess` обновляются фоном, без блокировки интерфейса.
- `is_excess` записи не могут быть изменены пользователем и удаляются при каждом пересчёте.
- Все операции с ведомостью транзакционны: либо вся ведомость загружена, либо откат к предыдущему состоянию.