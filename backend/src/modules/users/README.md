# Модуль пользователей (Users)

## Назначение
Модуль управляет основными пользователями системы, хранит их данные и обеспечивает связь с Telegram аккаунтами. Каждый пользователь системы связан с записью в `telegram_users` через поле `telegramUsersId`.

## Архитектура

### Файловая структура
users/
├── README.md (этот файл)
├── users.controller.ts # HTTP контроллер пользователей
├── users.module.ts # Модуль NestJS
├── users.service.ts # Сервис бизнес-логики
├── dto/ # Data Transfer Objects
│ ├── create-user.dto.ts
│ ├── update-user.dto.ts
│ └── user-response.dto.ts
└── entities/ # Сущности TypeORM
└── user.entity.ts

text

### Взаимосвязи модулей
Telegram авторизация
↓
AuthService вызывает UsersService.findOrCreate()
↓
Создание/поиск в users таблице
↓
Связь: users.telegramUsersId → telegram_users.id

text

## Основные компоненты

### 1. Контроллер (`users.controller.ts`)
**Защита:** Весь контроллер защищен `JwtAuthGuard`

**Маршруты:**
- `GET /api/users` - список всех пользователей системы
- `GET /api/users/:id` - данные конкретного пользователя

**Особенности:**
- В режиме `development` доступен без авторизации (для DevLogin.vue)
- В `production` требует валидный JWT токен

### 2. Сервис (`users.service.ts`)
Основные методы:

#### Создание и поиск
- `create(createUserDto)` - создание нового пользователя
- `findByTelegramUsersId(telegramUsersId)` - поиск по связи с Telegram
- `findById(id)` - поиск по внутреннему ID
- `findOrCreate(telegramUsersId, firstName, lastName)` - утилитарный метод для AuthService

#### Управление данными
- `findAll()` - получение всех пользователей
- `update(id, updateUserDto)` - обновление данных пользователя
- `remove(id)` - удаление пользователя

#### Генерация ABR
- `generateAbr(firstName, lastName)` - создание аббревиатуры (первая буква имени + первая буква фамилии)

### 3. Сущность (`user.entity.ts`)
**Таблица:** `users`

**Поля:**
- `id` - первичный ключ (автоинкремент)
- `telegramUsersId` - ссылка на `telegram_users.id` (unique, nullable)
- `firstName` - имя пользователя
- `lastName` - фамилия пользователя
- `abr` - аббревиатура для подписей (например: "ИИ" для "Иван Иванов")

### 4. DTO (Data Transfer Objects)

#### `create-user.dto.ts`
Для создания пользователя:
- `telegramUsersId` - обязательный, ссылка на Telegram аккаунт
- `firstName`, `lastName` - обязательные
- `abr` - генерируется автоматически если не указан

#### `update-user.dto.ts`
Наследует `CreateUserDto` с `PartialType`:
- Все поля необязательные
- При обновлении имени/фамилии сервис автоматически пересчитывает `abr`

#### `user-response.dto.ts`
Для безопасного ответа API:
- Содержит все поля сущности кроме чувствительных данных
- Можно расширять с `class-transformer` для исключения полей

## Рабочий процесс

### 1. Авторизация нового пользователя

Telegram Widget → AuthService → UsersService.findOrCreate()
↓
Проверка по telegramUsersId
↓
Не найден? → Создание нового
↓
Генерация abr + сохранение в БД

### 2. Обновление данных пользователя

// При обновлении имени или фамилии:
await usersService.update(1, { 
  firstName: 'НовоеИмя',
  lastName: 'НоваяФамилия'
});
// Сервис автоматически пересчитает abr → "НН"

### 3. Получение списка пользователей

// Используется в DevLogin.vue для выбора тестового пользователя
GET /api/users → возвращает массив пользователей для выбора


## Особенности реализации

### Автоматическая генерация ABR
При создании: generateAbr("Иван", "Иванов") → "ИИ"
При обновлении: если меняется имя или фамилия → пересчет ABR
ABR используется для подписей в системе

### Связь с Telegram
Один Telegram аккаунт → один пользователь системы
Поле telegramUsersId уникальное, но может быть null (для тестовых пользователей)
Удаление в telegram_users не каскадирует на users

### Безопасность
Все endpoints защищены JWT
В development режиме доступны для тестирования
Нет endpoints для создания пользователей напрямую (только через авторизацию)

### Зависимости модуля
TypeOrmModule - работа с базой данных
JwtAuthModule - проверка JWT токенов
AuthModule - основной потребитель сервиса

## Использование в других модулях

### В AuthService
// Поиск существующего пользователя
const user = await usersService.findByTelegramUsersId(telegramUsersId);

// Создание нового пользователя
const newUser = await usersService.findOrCreate(
  telegramUsersId,
  firstName,
  lastName
);

### В контроллерах
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@Req() request) {
  // Получение данных текущего пользователя
  const userId = request.user.sub;
  const user = await usersService.findById(userId);
  return user;
}

## Примеры запросов

### Получение списка пользователей
Development режим (без токена)
GET /api/users

Production режим (с токеном)
GET /api/users
Authorization: Bearer <your_jwt_token>

### Получение конкретного пользователя
GET /api/users/1
Authorization: Bearer <your_jwt_token>