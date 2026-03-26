import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogsService } from '../../modules/logs/logs.service';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggerInterceptor.name);

  constructor(private readonly logsService: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    const { method, url, headers, body, query } = request;
    
    // Получаем userId из JWT (поле sub, как в твоем guard)
    const userId = request.user?.sub || null;
    
    // Для больших body не логируем целиком, только краткую сводку
    const bodySummary = body && typeof body === 'object' 
      ? { keys: Object.keys(body), hasPassword: !!body.password }
      : null;

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const duration = Date.now() - start;
          const statusCode = context.switchToHttp().getResponse().statusCode;
          
          // Асинхронная запись лога (не ждем)
          this.logsService.log('backend', userId, {
            type: 'request',
            method,
            path: url,
            statusCode,
            duration,
            query: Object.keys(query).length ? query : undefined,
            bodySummary,
            userAgent: headers['user-agent'],
            ip: headers['x-forwarded-for'] || request.ip,
          });
        },
        error: (error: any) => {
          // Ошибки ловятся в AllExceptionsFilter, здесь дублировать не нужно
          this.logger.debug(`Request failed: ${method} ${url} - ${error.message}`);
        }
      })
    );
  }
}