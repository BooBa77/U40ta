# Модуль Statements (Ведомости)

Модуль для обработки ведомостей из Excel файлов (вложений email).

## Структура модуля
statements/
├── dto/
│   ├── parsed-excel-row.dto.ts
│   ├── create-processed-statement.dto.ts
│   ├── update-processed-statement.dto.ts
│   └── statement-response.dto.ts
├── entities/
│   └── processed-statement.entity.ts
├── services/
│   ├── statement.service.ts
│   ├── statement-parser.service.ts
│   └── statement-objects.service.ts
├── statements.controller.ts
└── statements.module.ts

## Поток данных (Data Flow)
1. Запрос от клиента: GET /api/statements/123
2. Контроллер (StatementsController): Принимает числовой attachmentId через ParseIntPipe
3. Главный сервис (StatementService): Проверяет вложение, определяет состояние ведомости, возвращает ProcessedStatementDto[]
4. Парсер (StatementParserService): Читает Excel → ParsedExcelRowDto[], создает Entity → ProcessedStatement[], сохраняет в БД, преобразует в ProcessedStatementDto[]
5. Ответ клиенту: StatementResponseDto { success, attachmentId, statements: ProcessedStatementDto[], count, message?, error? }

## Логика работы
1. Первое открытие ведомости: парсится Excel, создаются записи в БД, вычисляются флаги have_object/is_excess
2. Повторное открытие: сразу возвращаются существующие записи, фоново обновляются флаги (логи "фоновое обновление флагов завершено")
3. Ведомость помечается как "в работе" (in_process = true) пока не будет открыта новая ведомость для того же склада/типа
4. При обновлении флагов отправляются SSE уведомления для обновления интерфейса

## Зачем нужны DTO?
Без DTO: Entity напрямую в API, передаются все поля (даже приватные), связи TypeORM уходят на фронтенд, нет типизации ответов, сложно менять API.
С DTO: Entity → DTO → API, контролируем что передаём, только нужные данные, Strict TypeScript типы, легко менять DTO без изменения Entity.

## Различие между Entity и DTO
Entity (ProcessedStatement) - для работы с БД (TypeORM), содержит связи, миграции. DTO (ProcessedStatementDto) - для передачи данных между слоями, без связей, только нужные данные.

## Список DTO и их назначение
1. ParsedExcelRowDto - типизация строк Excel, используется в StatementParserService.parseExcel()
2. CreateProcessedStatementDto - для будущих эндпоинтов создания записей, содержит все обязательные поля
3. UpdateProcessedStatementDto - для обновления флагов через API (have_object, is_ignore, is_excess)
4. StatementResponseDto + ProcessedStatementDto - основной ответ API, содержит массив ProcessedStatementDto, методы fromEntity() и fromEntities() для преобразования

## Флаги записей
1. have_object - есть ли реальный объект в системе для этой строки ведомости
2. is_excess - объект есть в системе, но отсутствует в ведомости (лишний объект на складе)
3. is_ignore - флаг игнорирования строки (для ручного управления)

## Как добавить новый endpoint?
1. Создать DTO для запроса (если нужен)
2. Добавить метод в контроллер с параметрами @Param() и @Body()
3. Использовать DTO в сервисе для бизнес-логики
4. Возвращать ProcessedStatementDto или StatementResponseDto

## Особенности реализации
1. Пропускаются строки Excel без номера материала (итоговые строки)
2. Обрабатывается количество объектов из колонки "Запас на конец периода"
3. Удаляются старые записи при открытии новой ведомости для того же склада/типа
4. Поддерживается транзакционность операций с БД