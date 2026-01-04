// Для параметров запроса GET /api/statements/:attachmentId
export class GetStatementParamsDto {
  attachmentId: string; // @Param() всегда возвращает строку
}