# Модуль Telegram пользователей (Telegram-Users)

## Назначение
Модуль управляет учетными записями пользователей Telegram, которые авторизовались через Telegram Widget. Хранит базовые данные из Telegram (ID, имя, фамилия, username) и служит промежуточным звеном между Telegram-идентификаторами и внутренними пользователями системы.

## Архитектура

### Файловая структура
telegram-users/
├── README.md (этот файл)
├── telegram-users.controller.ts     # HTTP контроллер
├── telegram-users.controller.spec.ts # Тесты контроллера
├── telegram-users.module.ts         # Модуль NestJS
├── telegram-users.service.ts        # Сервис бизнес-логики
├── telegram-users.service.spec.ts   # Тесты сервиса
├── dto/                             # Data Transfer Objects
│   ├── create-telegram-user.dto.ts
│   └── update-telegram-user.dto.ts
└── entities/                        # Сущности TypeORM
    └── telegram-user.entity.ts

### Взаимосвязи модулей
Telegram Widget → AuthService → TelegramUsersService → telegram_users таблица
↓
users.telegramUsersId ссылается на telegram_users.id

text

## Основные компоненты

### 1. Контроллер (`telegram-users.controller.ts`)
**Защита:** Весь контроллер защищен `JwtAuthGuard`

**Маршруты:**
- `GET /api/telegram-users` - список всех Telegram пользователей
- `GET /api/telegram-users/:id` - данные по внутреннему ID
- `GET /api/telegram-users/telegram/:telegramId` - данные по Telegram ID
- `POST /api/telegram-users` - создание новой записи
- `PUT /api/telegram-users/:id` - обновление записи
- `DELETE /api/telegram-users/:id` - удаление записи

### 2. Сервис (`telegram-users.service.ts`)
Основные методы:

#### Создание и поиск
- `create(createTelegramUserDto)` - создание новой записи
- `findByTelegramId(telegramId)` - поиск по уникальному Telegram ID
- `findById(id)` - поиск по внутреннему ID
- `findOrCreate(telegramId, userData)` - основной метод для AuthService

#### Управление данными
- `findAll()` - все записи из таблицы
- `update(id, updateTelegramUserDto)` - обновление данных
- `remove(id)` - удаление записи

### 3. Сущность (`telegram-user.entity.ts`)
**Таблица:** `telegram_users`

**Поля:**
- `id` - первичный ключ (автоинкремент)
- `telegram_id` - уникальный идентификатор из Telegram (UNIQUE)
- `first_name` - имя из Telegram (nullable)
- `last_name` - фамилия из Telegram (nullable)
- `username` - username из Telegram (nullable)

### 4. DTO (Data Transfer Objects)

#### `create-telegram-user.dto.ts`
Для создания записи:
- `telegram_id` - обязательный, уникальный ID из Telegram
- `first_name`, `last_name`, `username` - необязательные

#### `update-telegram-user.dto.ts`
Наследует `CreateTelegramUserDto` с `PartialType`:
- Все поля необязательные

## Рабочий процесс

### 1. Авторизация через Telegram Widget
Telegram Widget отправляет данные пользователя
↓
AuthService.processTelegramData()
↓
TelegramUsersService.findOrCreate(telegramId, userData)
↓
Существующая запись? → Да → Возвращаем
↓
Нет → Создаем новую запись в telegram_users
↓
Возвращаем TelegramUser для связи с users таблицей

text

### 2. Связь с основной таблицей users
telegram_users.id (первичный ключ)
↓
users.telegramUsersId (внешний ключ, unique, nullable)

text

### 3. Использование findOrCreate в авторизации
```typescript
// В TelegramAuthService.processTelegramData()
const createTelegramUserDto = {
  telegram_id: telegramData.id,
  first_name: telegramData.first_name,
  last_name: telegramData.last_name || null,
  username: telegramData.username || null,
};

const user = await telegramUsersService.findOrCreate(
  telegramData.id,
  createTelegramUserDto
);
Особенности реализации
Уникальность telegram_id
Поле telegram_id уникальное (UNIQUE constraint)

Один Telegram аккаунт → одна запись в telegram_users

При повторной авторизации находится существующая запись

Nullable поля
first_name, last_name, username могут быть null

Telegram не всегда предоставляет все данные

Валидация в DTO использует @IsOptional()

Связь с users таблицей
Связь "один к одному" через telegramUsersId

telegramUsersId в таблице users ссылается на id в telegram_users

При удалении из telegram_users нужно обрабатывать связь вручную

Безопасность
Все endpoints защищены JWT

Прямой доступ к API только для административных целей

Основное использование - через AuthService

Зависимости модуля
TypeOrmModule - работа с базой данных

JwtAuthModule - проверка JWT токенов

AuthModule - основной потребитель сервиса

Использование в других модулях
В AuthService
typescript
// Поиск существующего пользователя Telegram
const telegramUser = await telegramUsersService.findByTelegramId(telegramData.id);

// Создание/поиск с автоматическим созданием
const telegramUser = await telegramUsersService.findOrCreate(
  telegramData.id,
  telegramData
);
В контроллерах других модулей
typescript
// Получение Telegram данных для пользователя
@Get('user/:id/telegram-info')
@UseGuards(JwtAuthGuard)
async getTelegramInfo(@Param('id') userId: number) {
  const user = await usersService.findById(userId);
  if (user.telegramUsersId) {
    return telegramUsersService.findById(user.telegramUsersId);
  }
  return null;
}
Примеры запросов
Создание записи (используется AuthService)
bash
POST /api/telegram-users
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "telegram_id": 123456789,
  "first_name": "Иван",
  "last_name": "Иванов",
  "username": "ivanov"
}
Поиск по Telegram ID
bash
GET /api/telegram-users/telegram/123456789
Authorization: Bearer <jwt_token>
Получение всех записей
bash
GET /api/telegram-users
Authorization: Bearer <jwt_token>