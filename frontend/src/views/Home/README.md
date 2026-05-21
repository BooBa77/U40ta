# Модуль Home - Главная страница приложения

## Обзор

Модуль `Home` — главная страница приложения U40TA. Объединяет функциональность для двух ролей: МОЛ (материально-ответственное лицо) и Ревизор. Обеспечивает QR-сканирование объектов, работу с почтовыми ведомостями, управление инвентаризационными книгами и офлайн-режим.

## Структура компонентов

### Основные компоненты

1. **Home.vue** — корневой компонент, оркестрирует все секции и модалки
2. **EmailAttachmentsSection.vue** — список почтовых ведомостей МОЛ с автообновлением
3. **InventoryBooksSection.vue** — список инвентаризационных книг ревизора
4. **InventoryBookEditModal.vue** — универсальная модалка создания/редактирования книги
5. **BottomMenu.vue** — фиксированное нижнее меню с кнопками действий
6. **FlightModeToggle.vue** — переключатель офлайн/онлайн режима

### Вспомогательные компоненты

- **BaseModal.vue** — переиспользуемое модальное окно (из `components/common`)
- **ObjectFormModal.vue** — модалка редактирования объекта (по QR-коду)
- **PWAInstallButton.vue** — кнопка установки PWA (логика перенесена в BottomMenu)

## Роли и доступ

| Роль | Видит на Home | Может делать |
|------|---------------|--------------|
| МОЛ | EmailAttachmentsSection, кнопка "Инструменты" | Открывать ведомости, удалять вложения |
| Ревизор | InventoryBooksSection, кнопка "Новая инвентаризация" | Создавать/редактировать книги, управлять командой |
| МОЛ + Ревизор | Обе секции, все кнопки | Весь функционал |
| Гость | QR-сканер | Сканировать QR-коды объектов |

## Функциональность

### 1. Почтовые ведомости МОЛ

**EmailAttachmentsSection.vue:**

- Список вложений из email (фильтрация через `mol_access` на бэке)
- Открытие ведомости по клику → `/statement/[id]`
- Автопроверка почты каждые 5 минут (без ручной кнопки)
- Удаление вложений (только онлайн)
- Обновление через SSE: `statement-loaded`, `statement-deleted`, `statement-updated`

### 2. Инвентаризационные книги ревизора

**InventoryBooksSection.vue:**

- Список книг, доступных ревизору (через `revisor_access`)
- Открытие книги → `/inventory-book/[id]`
- Кнопка "Редактировать" (только для владельца, `isOwner: true`)
- Кнопка скрыта в офлайн-режиме
- Обновление через SSE: `inventory-book-changed`, `access-changed`

**InventoryBookEditModal.vue:**

- Создание: название + выбор batch'ей (с удалением) + выбор ревизоров
- Редактирование: название + состав книги (batch'и с ⚠ для подтверждённых) + команда
- Предупреждение при снятии batch'а с `isOkManual`/`isOkAuto`
- Доступ: список ревизоров с чекбоксами (текущий пользователь исключён)
- Одна кнопка "Сохранить" для всего: название, состав, доступ
- При создании: сначала книга → получен `id` → затем записи в `revisor_access`

### 3. Нижнее меню

**BottomMenu.vue** — фиксированное меню, видно только авторизованным:

| Позиция | Кнопка | Кто видит | Скрыта в офлайне |
|---------|--------|-----------|-------------------|
| Левая | "Новая инвентаризация" | Ревизор | Да |
| Центр | "Инструменты" | МОЛ | Нет (заглушка) |
| Правая | "Установить PWA" | Все (если доступна установка) | Да |

### 4. Офлайн-режим

- Включение: кэширование данных в IndexedDB через `offline-cache-service`
- Выключение: синхронизация изменений + очистка кэша
- Ревизор: список книг отображается, кнопка "Редактировать" скрыта
- МОЛ: список ведомостей отображается, удаление скрыто
- SSE не подключается в офлайне

### 5. QR-сканирование

- Сканирование камерой или переход по ссылке `/scan/:qrCode`
- Поиск объекта через `qrService`
- Открытие `ObjectFormModal` с данными объекта
- Поддержка онлайн и офлайн режимов

## SSE-события

| Событие | Отправитель | Получатель | Действие |
|---------|-------------|------------|----------|
| `statement-loaded` | Бэкенд | EmailAttachmentsSection | Обновить список |
| `statement-updated` | Бэкенд | EmailAttachmentsSection | Обновить список |
| `statement-deleted` | Бэкенд | EmailAttachmentsSection | Обновить список |
| `inventory-book-changed` | Бэкенд | InventoryBooksSection | Обновить список |
| `access-changed` | Бэкенд | Home.vue | Перепроверить роли (fetchUserAbr, checkAccessToStatements, fetchIsRevisor) |
| `user-data-updated` | Бэкенд | Home.vue | Обновить аббревиатуру |

## Интеграция с API

### МОЛ
- `GET /api/email/attachments` — список вложений
- `DELETE /api/email/attachments/:id` — удаление
- `POST /api/email/check` — проверка почты (автотаймер)

### Ревизор
- `GET /api/inventory/books` — список книг
- `GET /api/inventory/books/:id` — книга
- `GET /api/inventory/books/:id/items` — строки книги
- `POST /api/inventory/books` — создать книгу
- `PATCH /api/inventory/books/:id` — обновить книгу
- `DELETE /api/inventory/books/:id` — удалить книгу
- `GET /api/inventory/books/:id/access` — список доступа
- `POST /api/inventory/books/:id/access` — добавить ревизора
- `DELETE /api/inventory/books/:id/access/:userId` — убрать ревизора
- `GET /api/inventory/batches` — список batch'ей
- `GET /api/inventory/batches/items` — строки batch'а
- `DELETE /api/inventory/batches` — удалить batch

### Пользователь
- `GET /api/users/me/abr` — аббревиатура
- `GET /api/users/me/has-access-to-statements` — проверка МОЛ
- `GET /api/users/me/is-revisor` — проверка ревизора
- `GET /api/users` — список пользователей (для выбора ревизоров)

### Офлайн
- `GET /api/offline/data` — загрузка данных для кэширования
- `POST /api/offline/sync` — синхронизация изменений

## Сервисы фронта

- `email-attachment.service.js` — онлайн/офлайн работа с вложениями
- `inventory-book.service.js` — онлайн/офлайн работа с книгами
- `inventory-statements.service.js` — только онлайн, batch'и ревизора
- `offline-cache-service.js` — кэширование в IndexedDB
- `useCurrentUser.js` — композабл: `userAbr`, `isRevisor`, `fetchUserAbr`, `fetchIsRevisor`

## Стили

- Кнопки в модалках — Tailwind классы (`bg-gray-900`, `bg-red-500`, `hover:bg-black`)

## Меры безопасности

- JWT-авторизация на всех эндпоинтах
- Проверка `idOwner === userId` на бэке для редактирования/удаления книг
- Проверка `mol_access` для ведомостей МОЛ
- Проверка `revisor_access` для книг ревизора
- Frontend: кнопки управления скрыты по ролям и флагам владения