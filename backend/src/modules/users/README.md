# Модуль пользователей (Users)

## Назначение

Пользователи системы: фамилия, имя, аббревиатура для подписей и email. Здесь же
— доступы: кто материально ответственное лицо (МОЛ) и кто ревизор. Роли
**не поля пользователя**, а отдельные таблицы: `mol_access` и `revisors`.

Авторизации через Telegram в проекте нет (см. `docs/u40ta/AUDIT.md`).

## Файловая структура

```
users/
├── README.md            этот файл
├── users.controller.ts  HTTP-маршруты
├── users.module.ts      модуль NestJS
├── users.service.ts     бизнес-логика
├── dto/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   └── user-response.dto.ts
└── entities/
    ├── user.entity.ts
    ├── mol-access.entity.ts
    └── revisors.entity.ts
```

## Маршруты

Весь контроллер закрыт `JwtAuthGuard`. В режиме `development` guard пропускает
запросы — ради `DevLogin.vue`.

| Метод | Путь | Что возвращает |
|---|---|---|
| `GET` | `/api/users` | список пользователей |
| `GET` | `/api/users/:id` | одного пользователя |
| `GET` | `/api/users/revisors-list` | список ревизоров |
| `GET` | `/api/users/me/id` | id текущего пользователя |
| `GET` | `/api/users/me/abr` | аббревиатуру текущего |
| `GET` | `/api/users/me/mol-access` | склады, к которым есть доступ |
| `GET` | `/api/users/me/has-access-to-sklad/:zavod/:sklad` | есть ли доступ к складу |
| `GET` | `/api/users/me/has-access-to-statements` | может ли работать с ведомостями |
| `GET` | `/api/users/me/is-revisor` | ревизор ли текущий |

## Сервис

| Метод | Зачем |
|---|---|
| `create(dto)` | создать пользователя |
| `createWithEmail(email, firstName, lastName, abr)` | создать пользователя с готовой аббревиатурой; сейчас нигде не вызывается — вход идёт через `create` |
| `findById(id)`, `findAll()` | поиск |
| `findByEmail(email)` | поиск по email — используется при входе |
| `update(id, dto)`, `remove(id)` | правка и удаление |
| `getMolAccess(userId)`, `findMolsByLocations(locations)` | доступы МОЛ |
| `findAllRevisors()`, `isRevisor(userId)` | ревизоры |
| `hasAccessToStatements(userId)` | право работать с ведомостями |
| `hasAccessToSklad(userId, zavod, sklad)` | право по конкретному складу |

## Сущность

Таблица `users`, пять колонок:

| Поле | Колонка | Примечание |
|---|---|---|
| `id` | `id` | первичный ключ |
| `lastName` | `last_name` | фамилия |
| `firstName` | `first_name` | имя |
| `abr` | `abr` | аббревиатура для подписей, до 3 символов |
| `eMail` | `e_mail` | email, может быть пустым |

## DTO

- **`create-user.dto.ts`** — `firstName`, `lastName`, `eMail`; email проверяется
  `@IsEmail` и `@IsNotEmpty`;
- **`update-user.dto.ts`** — самостоятельный класс, а не `PartialType`: те же три
  поля, каждое под `@IsOptional`; при смене имени или фамилии сервис
  пересчитывает `abr`;
- **`user-response.dto.ts`** — `id`, `firstName`, `lastName`, `abr`, `eMail` под
  `@Expose`; сейчас в API не используется — контроллер отдаёт сущность как есть.

## Рабочий процесс: вход по email

1. Пользователь вводит email, `AuthService` отправляет код.
2. При проверке кода `AuthService` ищет пользователя через `findByEmail`.
3. Не находит — создаёт через `create({ firstName, lastName, eMail })`: имя и
   фамилию `AuthService` выводит из локальной части адреса, `abr` считает
   `UsersService` как первые буквы имени и фамилии.
4. Выдаётся JWT.

## Зависимости модуля

- `TypeOrmModule.forFeature([User, MolAccess, Revisors])` — таблицы модуля;
- `JwtAuthModule` — `JwtAuthGuard` на контроллере;
- наружу экспортируется только `UsersService`; его импортируют `auth`, `email`,
  `inventory`, `mol`, `offline` и `proposed-changes`.

## Особенности

- **Аббревиатура** считается из фамилии и имени и используется для подписей;
  при обновлении имени или фамилии пересчитывается автоматически.
- **Доступы** (МОЛ, ревизор) живут в отдельных таблицах, а не в `users`: один
  пользователь может быть МОЛ на нескольких складах.
- **Создать пользователя напрямую через API нельзя** — только входом, чтобы в
  системе не появлялись записи без владельца.
