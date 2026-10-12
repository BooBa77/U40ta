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
EMAIL_ATTACHMENTS_PATH
TELEGRAM_BOT_TOKEN
```

## Схема базы данных

**`synchronize` выключен явно** (`backend/src/app.module.ts`), чтобы TypeORM не
затирал данные. Миграций при этом нет — таблицы `migrations` в базе тоже нет,
то есть изменения схемы сейчас применяются вручную и нигде не фиксируются.
Это главный технический долг проекта.

## Сборка и деплой

`.github/workflows/build.yml`: на push в `main` собираются и публикуются два
образа — `ghcr.io/booba77/u40ta-backend:latest` и
`ghcr.io/booba77/u40ta-frontend:latest`. **Тег всегда `latest`**, откатиться на
предыдущую версию по тегу нельзя.

```sh
# на сервере
cd /home/dl_admin_tsy/u40ta-prod
docker compose pull && docker compose up -d
```

`pull` без `up -d` ничего не меняет: образ только скачивается, контейнер
остаётся на старом. Проверка после деплоя:

```sh
curl -s https://u40ta.booba.fvds.ru/api/health   # если эндпоинт есть
docker ps --filter name=u40ta-prod
```

## Грабли

| Что | Почему |
|---|---|
| В прод-`docker-compose.yml` **нет `env_file`** | Переменные перечислены поимённо в `environment:`. Новая переменная в `.env` сама в контейнер не попадёт — её нужно добавить и в compose |
| `TELEGRAM_BOT_TOKEN` объявлен в compose, но не задан в `.env` | При каждом `docker compose` в лог падает «Defaulting to a blank string» |
| У backend **нет томов** | `EMAIL_ATTACHMENTS_PATH` указывает в каталог, которого в контейнере нет. Появившиеся вложения исчезнут при первом пересоздании контейнера |
| Тег образов всегда `latest` | Откат возможен только пересборкой из конкретного коммита |
| `.gitignore` не действует на уже отслеживаемые файлы | Корневой `node_modules/` был закоммичен до появления правил и остаётся в индексе |
| Node 20 против Node 24 в соседнем проекте | Обновление рантайма — отдельная задача, требует проверки `sharp` и нативных зависимостей |

## Тестов нет

Jest настроен в `backend/package.json`, но ни одного `*.spec.ts` в проекте нет.
Автотесты отсутствуют полностью.
