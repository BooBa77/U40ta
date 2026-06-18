markdown
# Модуль авторизации (Auth)

## Назначение
Модуль отвечает за аутентификацию и авторизацию пользователей через Telegram Widget. Вся логика входа, генерации JWT токенов и защиты endpoints реализована здесь.

## Архитектура

### Файловая структура
auth/
├── README.md (этот файл)
├── auth.controller.ts # HTTP контроллер авторизации
├── auth.module.ts # Модуль NestJS
├── jwt-auth.module.ts # Модуль JWT аутентификации
├── dto/ # Data Transfer Objects
│ ├── auth-response.dto.ts
│ └── telegram-login.dto.ts
├── guards/ # Guards (защитники маршрутов)
│ └── jwt-auth.guard.ts
└── services/ # Сервисы бизнес-логики
├── auth.service.ts
└── telegram-auth.service.ts

text

### Взаимосвязи модулей
Telegram Widget (frontend)
↓
auth.controller.ts (POST /api/auth/telegram)
↓
auth.service.ts (обработка логики)
├── telegram-auth.service.ts (работа с Telegram)
├── users.service.ts (из users модуля)
├── telegram-users.service.ts (из telegram-users модуля)
└── jwtService (генерация токена)
↓
JWT токен → фронтенд → localStorage

text

## Основные компоненты

### 1. Контроллер (`auth.controller.ts`)
**Маршруты:**
- `POST /api/auth/telegram` - авторизация через Telegram Widget
- `POST /api/auth/dev-login` - авторизация для разработки (только не-production)

### 2. Сервисы
#### `auth.service.ts`
Центральный сервис авторизации:
- `telegramLogin()` - основной метод обработки входа через Telegram
- `devLogin()` - для режима разработки
- `generateJwtToken()` - генерация JWT с payload:
  - `sub` - ID пользователя
  - `abr` - аббревиатура для подписей
  - `firstName`, `lastName` - имя и фамилия
  - `telegramUsersId` - ссылка на telegram_users

#### `telegram-auth.service.ts`
Специализированный сервис для работы с Telegram:
- `processTelegramData()` - обработка данных от Telegram Widget
- `validateTelegramData()` - валидация данных (заглушка)

### 3. Guards (защитники)
#### `jwt-auth.guard.ts`
Защищает endpoints, требующие авторизацию:
- Извлекает токен из `Authorization: Bearer <token>`
- В режиме `development` пропускает все запросы (для удобства разработки)
- Валидирует JWT токен и добавляет `user` в объект запроса

### 4. DTO (Data Transfer Objects)
#### `telegram-login.dto.ts`
Валидация входящих данных от Telegram:
- `id`, `first_name`, `last_name`, `username`
- `auth_date`, `hash` (для будущей проверки подлинности)

#### `auth-response.dto.ts`
Ответ после успешной авторизации:
- `access_token` - JWT токен для последующих запросов

## Рабочий процесс авторизации

1. **Frontend**: Пользователь нажимает кнопку Telegram Widget
2. **Telegram Widget**: Отправляет данные пользователя на `/api/auth/telegram`
3. **Backend**:
   - Контроллер принимает данные
   - AuthService обрабатывает их:
     a. Находит/создает запись в `telegram_users`
     b. Находит/создает пользователя в `users`
     c. Генерирует JWT токен
   - Возвращает `{ access_token: token }`
4. **Frontend**: Сохраняет токен в `localStorage` и перенаправляет на `/`

## Настройки JWT
- Секретный ключ: `JWT_SECRET` (из переменных окружения)
- Время жизни: `JWT_EXPIRES_IN` (по умолчанию '90d')
- Алгоритм: HS256 (по умолчанию)

## Особенности реализации

### Гостевая система
В новой системе **нет состояния "ожидания одобрения"**. Все пользователи Telegram автоматически получают доступ как гости.

### Режим разработки
- В `development` режиме:
  - `JwtAuthGuard` пропускает все запросы
  - Доступен `dev-login` endpoint для тестирования
- В `production` режиме:
  - Требуется валидный JWT токен
  - `dev-login` endpoint недоступен

### Зависимости модуля
- `UsersModule` - работа с основными пользователями
- `TelegramUsersModule` - работа с Telegram аккаунтами
- `ConfigModule` - доступ к настройкам
- `JwtModule` - работа с JWT токенами

## Использование в других модулях

### Защита endpoints
```typescript
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  // ... защищенные методы
}
Получение данных пользователя в контроллере
typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@Req() request) {
  // request.user содержит payload из JWT токена
  const userId = request.user.sub;
  const userName = request.user.firstName;
  // ...
}
Переменные окружения
env
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=90d
NODE_ENV=development|production