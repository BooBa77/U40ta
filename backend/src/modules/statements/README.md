# Модуль Statements (Ведомости)

Модуль для обработки ведомостей из Excel файлов (вложений email).

## Структура модуля
statements/
├── dto/
│   ├── parsed-excel-row.dto.ts
│   ├── create-processed-statement.dto.ts
│   ├── update-processed-statement.dto.ts
│   ├── get-statement-params.dto.ts
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
2. Контроллер (StatementsController): Принимает GetStatementParamsDto, преобразует attachmentId в число
3. Главный сервис (StatementService): Проверяет вложение, определяет состояние ведомости, возвращает ProcessedStatementDto[]
4. Парсер (StatementParserService): Читает Excel → ParsedExcelRowDto[], создает Entity → ProcessedStatement[], сохраняет в БД, преобразует в ProcessedStatementDto[]
5. Ответ клиенту: StatementResponseDto { success, attachmentId, statements: ProcessedStatementDto[], count, message?, error? }

## Список DTO и их назначение
1. ParsedExcelRowDto - типизация строк Excel, используется в StatementParserService.parseExcel()
2. CreateProcessedStatementDto - для будущих эндпоинтов создания записей, содержит все обязательные поля
3. UpdateProcessedStatementDto - для обновления флагов через API (have_object, is_ignore, is_excess)
4. GetStatementParamsDto - для параметров запроса, используется в StatementsController.getStatement()
5. StatementResponseDto + ProcessedStatementDto - основной ответ API, содержит массив ProcessedStatementDto, методы fromEntity() и fromEntities() для преобразования
