# u40ta

Учёт оргтехники и материальных ценностей: объекты, инвентарные книги и
ведомости, материально ответственные лица (МОЛ), акты, QR-коды на объектах,
фотографии, предложения изменений с модерацией, журнал действий.

Рабочий сценарий: QR-код на объекте → сканирование с телефона → ведомость →
согласование → акт. Есть офлайн-режим (`backend/src/modules/offline`) для работы
в помещениях без связи.

**Прод:** <https://u40ta.booba.fvds.ru>

## Стек

| Слой | Что |
|---|---|
| Backend | NestJS 11, TypeORM 0.3, PostgreSQL 16, JWT, Throttler, SSE |
| Почта | `imap` + `mailparser` (разбор входящих писем и Excel-вложений), `nodemailer` |
| Прочее | `sharp` (фото), `xlsx` (ведомости) |
| Frontend | Vue 3, Vite, Tailwind, Pinia; IndexedDB для офлайн-режима |
| Рантайм | Node 20 (`node:20-alpine`) |

## Структура

```
backend/src/
  common/            фильтры, перехватчики, интерфейсы
  modules/
    auth/            вход, JWT
    users/           пользователи
    objects/         объекты инвентарного учёта
    inventory/       инвентаризационные ведомости ревизоров
    statements/      акты и ведомости
    mol/             инструменты МОЛ, экспорт таблиц
    proposed-changes/ предложения правок от гостей + модерация
    qr-codes/        связь QR-значений с объектами
    photos/          фотографии объектов
    email/           IMAP-приём и SMTP-отправка
    offline/         кэширование в IndexedDB и обратная синхронизация
    logs/            журнал действий (пишется в БД)
    app-events/      SSE для мгновенных уведомлений
frontend/src/        views, компоненты, стили
```

У каждого модуля бэкенда и каждой крупной вьюхи фронтенда есть свой `README.md`.

## Запуск для разработки

Нужен файл `.env` в корне (в репозиторий не входит — есть только имена
переменных в `docker-compose.yml`).

```sh
docker compose up -d          # postgres :5432, backend :3000, frontend :5173
docker compose exec backend npm run start:dev
```

Dev-стек монтирует `./backend` и `./frontend` в контейнеры, а `node_modules`
держит в отдельных томах, поэтому локальные `node_modules` не нужны.

API живёт под префиксом `/api` (`app.setGlobalPrefix('api')`). Запросы фронтенда
идут через прокси Vite (`/api` → `http://backend:3000`), поэтому в браузере это
один источник и CORS не срабатывает.

## Переменные окружения

Настраиваются в `.env` (dev) и в `.env` на сервере (прод). В репозитории
значений нет.

```
DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
NODE_ENV, PORT, JWT_SECRET, JWT_EXPIRES_IN
EMAIL_IMAP_USER, EMAIL_IMAP_PASSWORD, EMAIL_IMAP_HOST, EMAIL_IMAP_PORT, EMAIL_IMAP_TLS
EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT,
EMAIL_SMTP_SECURE, EMAIL_SMTP_FROM
```

## Документация API

Swagger живёт на [`/api/docs`](https://u40ta.booba.fvds.ru/api/docs): схема
собирается из декораторов контроллеров и DTO на старте приложения, поэтому новые
маршруты появляются в ней сами. Авторизация — Bearer-токен, который выдаёт
`POST /api/auth/email/verify`.

Проверка живости — `GET /api/health`. Маршрут без авторизации, отвечает
`{"status":"ok","db":"ok","latencyMs":…,"timestamp":…}`; запрос `SELECT 1` внутри
проверяет не «процесс жив», а работу с базой. Его дёргают мониторинг и проверка
после деплоя.

## Схема базы данных

**`synchronize` выключен явно** (`backend/src/app.module.ts`), чтобы TypeORM не
затирал данные. Схема меняется **только миграциями**: `backend/src/migrations/`
и скрипты `migration:*` в `backend/package.json`. Правка схемы руками ломает
соответствие между базой и историей миграций.

## Сборка и деплой

`.github/workflows/build.yml`: на push в `main` собираются и публикуются два
образа — `ghcr.io/booba77/u40ta-backend:latest` и
`ghcr.io/booba77/u40ta-frontend:latest`. **Тег всегда `latest`**, откатиться на
предыдущую версию по тегу нельзя.

```sh
# На сервере: сначала образы, потом миграции, и лишь затем переключение.
# Новый код ожидает новые колонки, поэтому обратный порядок даёт окно,
# в котором запросы к затронутым таблицам падают.
cd /home/dl_admin_tsy/u40ta-prod
docker compose pull
docker compose run --rm backend npm run migration:run:prod
docker compose up -d
```

`pull` без `up -d` ничего не меняет: образ только скачивается, контейнер
остаётся на старом. Проверка после деплоя:

```sh
curl -s https://u40ta.booba.fvds.ru/api/health   # {"status":"ok","db":"ok",...}
docker ps --filter name=u40ta-prod
docker compose logs --tail=30 backend            # логи: nestjs-pino
```

Логи пишет `nestjs-pino` в консоль контейнера — в проде JSON, в разработке
человекочитаемо. В базу технические логи не пишутся: там только бизнес-история
объектов.

## Грабли

| Что | Почему |
|---|---|
| В прод-`docker-compose.yml` **нет `env_file`** | Переменные перечислены поимённо в `environment:`. Новая переменная в `.env` сама в контейнер не попадёт — её нужно добавить и в compose |
| У backend **нет томов** — и это нормально | Вложения писем **не сохраняются на диск**: `imap.service.ts` передаёт содержимое файла (Buffer от mailparser) в анализ, и оно выбрасывается. Таблицы `email_attachments` в базе нет, каталог для файлов не нужен. Проверено 12.10.2026 по коду |
| Тег образов всегда `latest` | Откат возможен только пересборкой из конкретного коммита |
| `.gitignore` не действует на уже отслеживаемые файлы | Корневой `node_modules/` был закоммичен до появления правил и остаётся в индексе |
| Node 20 против Node 24 в соседнем проекте | Обновление рантайма — отдельная задача, требует проверки `sharp` и нативных зависимостей |

## Тестов нет

Jest настроен в `backend/package.json`, но ни одного `*.spec.ts` в проекте нет.
Автотесты отсутствуют полностью.
