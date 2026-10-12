# Модуль авторизации (Auth)

## Назначение

Вход в систему **по email с кодом подтверждения**: пользователь запрашивает код,
получает его письмом, вводит и получает JWT-токен. Отдельно есть вход для
разработки, доступный только вне production.

Авторизации через Telegram в проекте **нет** — она не реализована и не будет:
в РФ Telegram заблокирован (решение от 12.10.2026, см. `docs/u40ta/AUDIT.md`).

## Файловая структура

```
auth/
├── README.md                этот файл
├── auth.controller.ts       HTTP-маршруты авторизации
├── auth.module.ts           модуль NestJS
├── jwt-auth.module.ts       подключение JWT
├── dto/
│   ├── auth-response.dto.ts ответ с токеном
│   └── email-auth.dto.ts    SendCodeDto, VerifyCodeDto, CheckCodeStatusDto
├── guards/
│   └── jwt-auth.guard.ts    защита маршрутов
└── services/
    ├── auth.service.ts      логика входа
    └── email-code.service.ts генерация и проверка кодов
```

## Маршруты

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/api/auth/email/send-code` | отправляет код на email |
| `POST` | `/api/auth/email/verify` | проверяет код и возвращает `access_token` |
| `POST` | `/api/auth/email/check-status` | активен ли код (для восстановления состояния после F5) |
| `POST` | `/api/auth/dev-login` | вход по `userId` **только вне production**: в проде отдаёт 404 |

## Сервисы

### `auth.service.ts`

- `sendEmailCode(email)` — проверяет адрес, генерирует код, отправляет письмо;
- `verifyEmailCode(email, code)` — проверяет код, находит или создаёт
  пользователя и выдаёт JWT;
- `checkEmailCodeStatus(email)` — сколько осталось до истечения кода;
- `devLogin(userId)` — вход для разработки;
- выдача токена: полезная нагрузка содержит `sub` (id пользователя), `abr`,
  `firstName`, `lastName`.

### `email-code.service.ts`

Генерация, хранение и проверка кодов. **Коды живут в памяти процесса**: при
перезапуске бэкенда выданные коды теряются, и пользователю нужно запросить новый.
Это осознанное решение, а не недоделка — постоянное хранилище кодов не нужно.

## Guard

`jwt-auth.guard.ts` защищает маршруты, требующие входа:

- читает токен из `Authorization: Bearer <token>`;
- в режиме `development` **пропускает все запросы** — ради удобства разработки
  и `DevLogin.vue`;
- в production валидирует токен и кладёт `user` в объект запроса.

## Настройки JWT

| Переменная | Значение |
|---|---|
| `JWT_SECRET` | секрет, только в `.env` на сервере |
| `JWT_EXPIRES_IN` | срок жизни токена (в проде — `90d`) |
| алгоритм | HS256 |

## Зависимости модуля

- `UsersModule` — поиск и создание пользователей
- `ConfigModule` — доступ к переменным окружения
- `JwtModule` — выпуск и проверка токенов

## Использование в других модулях

```typescript
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('objects')
export class ObjectsController {
  @Get()
  findAll(@Req() request) {
    const userId = request.user.sub; // id пользователя из токена
    // ...
  }
}
```
