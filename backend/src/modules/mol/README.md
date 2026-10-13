# Модуль инструментов МОЛ (Mol)

## Назначение

Материально ответственное лицо (МОЛ) отвечает за объекты конкретного склада.
Модуль даёт ему две вещи: **выгрузку своих объектов в Excel** и **игнор-слова** —
список подстрок, по которым ведомости фильтруются автоматически при разборе почты.

## Файловая структура

| Файл | Назначение |
|---|---|
| `mol.controller.ts` | HTTP-маршруты |
| `mol.module.ts` | Модуль NestJS, помечен `@Global()` |
| `services/mol.service.ts` | Выгрузка объектов МОЛа в Excel вместе с историей |
| `services/ignore-keywords.service.ts` | Хранение игнор-слов и применение их к ведомостям |
| `services/ignore-keywords.matcher.ts` | Сопоставление строки со списком подстрок |
| `entities/ignore-keyword.entity.ts` | Сущность `IgnoreKeyword` (таблица `ignore_keywords`) |

## Маршруты

Весь контроллер закрыт `JwtAuthGuard`; в `development` guard пропускает запросы.

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/api/mol/export-excel` | выгрузка доступных МОЛу объектов в Excel |
| `GET` | `/api/mol/ignore-keywords` | список игнор-слов текущего пользователя |
| `POST` | `/api/mol/ignore-keywords` | добавить слово; `409`, если такое уже есть |
| `DELETE` | `/api/mol/ignore-keywords/:id` | удалить слово по id |
| `POST` | `/api/mol/ignore-keywords/replace-and-apply` | заменить список целиком и применить к ведомостям |

## Ключевые методы сервиса

| Метод | Зачем |
|---|---|
| `MolService.exportExcel(userId)` | собирает объекты по складам МОЛа и отдаёт файл |
| `IgnoreKeywordsService.getKeywords(userId)` | слова пользователя |
| `IgnoreKeywordsService.addKeyword(userId, keyword)` | добавить; дубликат — `ConflictException` |
| `IgnoreKeywordsService.removeKeyword(id, userId)` | удалить своё слово; чужое — `NotFoundException` |
| `IgnoreKeywordsService.replaceAndApply(userId, keywords)` | заменить набор и вернуть число обновлённых ведомостей |

## Особенности

- **Модуль помечен `@Global()`** ради `IgnoreKeywordsService`: его использует
  разбор ведомостей в `statements`, и явный импорт туда не добавляли. Это и
  минус — связь не видна в объявлениях модулей.
- **Для выгрузки читается таблица `logs`** (`source = 'object-history'`): строки
  истории объекта дополняются аббревиатурами пользователей. То есть история,
  которую пишет фронтенд, нужна не только вкладке «История» в карточке объекта,
  но и Excel-выгрузке МОЛа.
- **Игнор-слова действуют при разборе:** `replace-and-apply` не только меняет
  список, но и проходит по ведомостям, помечая строки, попавшие под подстроки.
- **Права проверяются в сервисах, а не в контроллере:** `removeKeyword` не даст
  удалить чужое слово, а `exportExcel` собирает только склады этого МОЛа.
