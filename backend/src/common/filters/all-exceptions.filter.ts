import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Глобальный фильтр исключений: приводит любой сбой к одному формату ответа и
 * пишет его в консольный лог процесса.
 *
 * В базу больше не пишет. Раньше ошибки уходили в таблицу `logs` с источником
 * `backend`, как и строка на каждый запрос от перехватчика. Таблица от этого
 * росла, а читать её было некому — техническая диагностика убрана 12.10.2026,
 * в базе остаётся только бизнес-история (история объектов, QR-кодов,
 * фотографий). Сбои смотрим через `docker compose logs`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`${request.method} ${request.url} - ${status} - ${message}`);
    if (stack && process.env.NODE_ENV === 'development') {
      this.logger.debug(stack);
    }

    // Отправляем ответ пользователю. Формат сохранён прежним: его ждёт фронтенд.
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR 
        ? 'Internal server error' 
        : message,
    });
  }
}
