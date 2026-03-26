import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from '../../modules/logs/logs.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly logsService: LogsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const userId = (request as any).user?.sub || null;
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    
    const message = exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : undefined;
    
    // Логируем ошибку в БД
    this.logsService.log('backend', userId, {
      type: 'error',
      method: request.method,
      path: request.url,
      statusCode: status,
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      message,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      body: this.sanitizeBody(request.body),
      query: request.query,
    });
    
    // Логируем в консоль для отладки
    this.logger.error(`${request.method} ${request.url} - ${status} - ${message}`);
    if (stack && process.env.NODE_ENV === 'development') {
      this.logger.debug(stack);
    }
    
    // Отправляем ответ пользователю
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR 
        ? 'Internal server error' 
        : message,
    });
  }
  
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';
    return sanitized;
  }
}