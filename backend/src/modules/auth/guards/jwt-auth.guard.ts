import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JwtAuthGuard - защищает endpoints требующие JWT авторизацию
 * Проверяет наличие и валидность JWT токена в заголовках запроса
 * В режиме разработки (development) автоматически пропускает запросы
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Основной метод guard - определяет можно ли активировать route
   * Вызывается автоматически NestJS для каждого защищенного endpoint
   * 
   * @param context - контекст выполнения (информация о запросе)
   * @returns boolean - true если доступ разрешен, false если запрещен
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.debug('Активация JwtAuthGuard для проверки доступа');

    // Проверяем режим разработки - в development пропускаем все запросы
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.debug('Режим разработки - JWT проверка отключена');
      return true;
    }

    // Получаем объект запроса из контекста
    const request = context.switchToHttp().getRequest();
    
    // Извлекаем JWT токен из заголовка Authorization
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      this.logger.warn('Попытка доступа без JWT токена');
      throw new UnauthorizedException('Требуется авторизация');
    }

    try {
      // Верифицируем JWT токен с использованием секретного ключа
      // Если токен невалиден - jwtService.verify() выбросит исключение
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      
      // Если токен валиден - добавляем payload к объекту запроса
      // Это позволяет получить данные пользователя в контроллерах без повторной проверки
      request.user = payload;
      
      this.logger.debug(`Успешная проверка JWT для пользователя: ${payload.first_name}`);
      
      return true;
    } catch (error) {
      this.logger.warn(`Невалидный JWT токен: ${error.message}`);
      throw new UnauthorizedException('Невалидный токен авторизации');
    }
  }

  /**
   * Извлекает JWT токен из заголовка Authorization
   * Ожидает формат: "Authorization: Bearer <token>"
   * 
   * @param request - объект HTTP запроса
   * @returns string | undefined - JWT токен или undefined если не найден
   */
  private extractTokenFromHeader(request: any): string | undefined {
    this.logger.debug('Извлечение JWT токена из заголовков запроса');

    // Получаем значение заголовка Authorization
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      this.logger.debug('Заголовок Authorization отсутствует');
      return undefined;
    }

    // Разделяем заголовок на части: "Bearer" и сам токен
    const [type, token] = authHeader.split(' ');
    
    // Проверяем что тип авторизации - Bearer
    if (type !== 'Bearer' || !token) {
      this.logger.debug(`Неверный формат заголовка Authorization: ${authHeader}`);
      return undefined;
    }

    this.logger.debug('JWT токен успешно извлечен из заголовка');
    return token;
  }
}