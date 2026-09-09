# Модуль Inventory — Инвентаризационные ведомости и книги ревизора

## Назначение
Модуль управляет инвентаризационными ведомостями, полученными от ревизоров по email, и сводными инвентаризационными книгами. Обеспечивает парсинг Excel-файлов, формирование книг из выбранных batch'ей, совместную работу ревизоров и доступ МОЛов к строкам книг.

## Архитектура

### Файловая структура
inventory/
├── inventory.controller.ts          # HTTP контроллер инвентаризации
├── inventory.module.ts              # Модуль NestJS
├── dto/
│   └── update-inventory-book.dto.ts # DTO обновления книги
├── entities/
│   ├── inventory-statement.entity.ts    # Строка ведомости ревизора
│   ├── inventory-book.entity.ts         # Инвентаризационная книга
│   ├── inventory-book-item.entity.ts    # Строка книги
│   ├── revisor-access.entity.ts         # Доступ ревизора к книге
│   └── inventory-book-mol-access.entity.ts # Доступ МОЛа к строкам книги
└── services/
    ├── inventory-statement-parser.service.ts # Парсинг Excel-файлов
    ├── inventory-statements.service.ts       # Работа с batch'ами
    ├── inventory-books.service.ts            # Работа с книгами
    ├── revisor-access.service.ts             # Доступ ревизоров
    └── mol-access.service.ts                 # Доступ МОЛов

## Основные компоненты

### 1. Контроллер (inventory.controller.ts)
**Защита:** Весь контроллер защищён JwtAuthGuard

**Маршруты:**

#### Batch'и (пакеты строк из Excel-файлов)
- `GET /api/inventory/batches` — список batch'ей ревизора
- `GET /api/inventory/batches/items` — строки конкретного batch'а
- `DELETE /api/inventory/batches` — удаление batch'а

#### Книги
- `GET /api/inventory/books` — книги, доступные ревизору
- `GET /api/inventory/books/:id` — книга по ID
- `GET /api/inventory/books/:id/items` — строки книги
- `POST /api/inventory/books` — создание книги
- `PATCH /api/inventory/books/:id` — обновление книги (только создатель)
- `DELETE /api/inventory/books/:id` — удаление книги (только создатель)
- `POST /api/inventory/books/:id/items/confirm` — подтверждение строк
- `POST /api/inventory/books/:id/items/update-actual` — изменение isActual
- `POST /api/inventory/books/:id/export-excel` — выгрузка в Excel

#### Доступ ревизоров
- `GET /api/inventory/books/:id/access` — список ревизоров с доступом
- `POST /api/inventory/books/:id/access` — добавить ревизора
- `DELETE /api/inventory/books/:id/access/:userId` — удалить ревизора

#### Доступ МОЛов
- `GET /api/inventory/books/:id/mol-candidates` — МОЛы, подходящие для книги
- `GET /api/inventory/books/:id/mol-access` — расшаренные МОЛы
- `POST /api/inventory/books/:id/mol-access` — расшарить для МОЛов
- `DELETE /api/inventory/books/:id/mol-access/:userId` — снять доступ МОЛа
- `GET /api/inventory/mol/items` — строки для текущего МОЛа

## Сущности

### InventoryStatement (inventory_statements)
Строка ведомости, полученной от ревизора по email.

Поля: `id`, `emailFrom`, `receivedAt`, `docType`, `zavod`, `sklad`, `invNumber`, `partyNumber`, `buhName`

Особенности:
- `emailFrom` — email ревизора-отправителя (нормализован в нижнем регистре)
- `docType` — 'ОСВ' или 'ОС'
- Группировка по `emailFrom + receivedAt + zavod + sklad` даёт batch

### InventoryBook (inventory_books)
Сводная инвентаризационная книга ревизора.

Поля: `id`, `name`, `createdAt`, `idOwner`

Особенности:
- `idOwner` — создатель книги, только он может редактировать/удалять
- Доступ других ревизоров через `revisor_access`

### InventoryBookItem (inventory_book_items)
Строка книги — снимок данных на момент добавления.

Поля: `id`, `idBook`, `idInventoryStatement`, `zavod`, `sklad`, `invNumber`, `partyNumber`, `buhName`, `idObject`, `placeTer`, `placePos`, `placeCab`, `placeUser`, `isActual`, `isOkManual`, `isOkAuto`, `idUserOkManualChecked`, `dateOkManualChecked`, `idUserOkAutoChecked`, `dateOkAutoChecked`, `rem`

Особенности:
- Не зависит от inventory_statements — исходные batch'и могут быть удалены
- `idObject` — связь с объектом учёта (NULL если не найден)
- Поля `place*` — снимок местоположения объекта при подтверждении

### RevisorAccess (revisor_access)
Доступ ревизора к книге.

Составной ключ: `idBook + userId`

### InventoryBookMolAccess (inventory_book_mol_access)
Доступ МОЛа к строке книги.

Составной ключ: `userId + inventoryBookItemId`

Особенности:
- Каскадное удаление при удалении строки книги
- МОЛ видит только строки, которые ему явно расшарили

## Процессы

### 1. Получение ведомости по email

Письмо с Excel → EmailModule → событие inventory.file.received → InventoryStatementParser → парсинг → сохранение в inventory_statements → SSE inventory-statement-loaded

### 2. Формирование книги

Ревизор открывает модалку → выбирает batch'и → система копирует строки из inventory_statements в inventory_book_items → создаётся книга → создателю даётся доступ через revisor_access

### 3. Совместная работа ревизоров

Создатель расшаривает книгу коллегам → коллеги видят книгу в списке → подтверждают строки (isOkManual/isOkAuto) → изменения видны всем через SSE

### 4. Задействование МОЛов

Создатель книги выбирает МОЛов из кандидатов (по mol_access) → система создаёт записи в inventory_book_mol_access для строк, где zavod+sklad совпадает → МОЛ видит секцию "Инвентаризация" на Home → открывает модалку со строками

### 5. Работа МОЛа

МОЛ видит строки с цветовой индикацией → использует фильтры для поиска объектов → кликает по строке → открывается карточка объекта → сопровождает ревизора к объекту → ревизор сканирует QR → строка зеленеет у МОЛа через SSE

## SSE-события

- `inventory-statement-loaded` — новые ведомости ревизора (email)
- `inventory-book-changed` — изменение книги (bookId)
- `objects-changed` — изменение объектов на складе (userId, zavod, sklad)

## Безопасность

- Все endpoints защищены JWT
- Редактирование/удаление книги — только создатель
- Проверка доступа через checkAccess перед любой операцией
- МОЛ видит только строки из inventory_book_mol_access
- Email нормализуется в нижнем регистре при сохранении

## Зависимости

- TypeOrmModule — работа с БД
- JwtAuthModule — JWT-аутентификация
- AppEventsModule — SSE-уведомления
- UsersModule — данные пользователей
- EmailModule — отправка писем
- xlsx — формирование Excel-файлов