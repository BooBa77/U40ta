import { Injectable, Logger } from '@nestjs/common';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';
import { TelegramUser } from '../../telegram-users/entities/telegram-user.entity';
import { CreateTelegramUserDto } from '../../telegram-users/dto/create-telegram-user.dto';

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(
    private telegramUsersService: TelegramUsersService,
  ) {}

  /**
   * Обработка данных от Telegram Widget
   * Находит или создает пользователя в telegram_users
   * В новой системе ВСЕГДА возвращает пользователя (гостевая система)
   */
  async processTelegramData(telegramData: any): Promise<{ user: TelegramUser; isNew: boolean }> {
    this.logger.log(`Обработка Telegram данных для пользователя: ${telegramData.first_name}`);
    
    // Подготавливаем DTO для создания/поиска пользователя Telegram
    const createTelegramUserDto: CreateTelegramUserDto = {
      telegram_id: telegramData.id,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name || null,
      username: telegramData.username || null,
    };

    // Используем новый метод findOrCreate из TelegramUsersService
    const user = await this.telegramUsersService.findOrCreate(
      telegramData.id,
      createTelegramUserDto
    );
    
    const isNew = !(await this.telegramUsersService.findByTelegramId(telegramData.id));
    
    this.logger.log(`Пользователь Telegram обработан: ID ${user.id}, новый: ${isNew}`);
    return { user, isNew };
  }

  /**
   * Проверка подлинности данных Telegram (опционально)
   * Может быть использована для дополнительной безопасности
   */
  async validateTelegramData(telegramData: any): Promise<boolean> {
    this.logger.log(`Проверка подлинности данных Telegram для ID: ${telegramData.id}`);
    
    // В минимальной реализации всегда возвращаем true
    // В продакшене можно реализовать проверку hash
    // Для гостевой системы проверка не критична
    
    // Заглушка для будущей реализации
    const isValid = true;
    
    this.logger.log(`Данные Telegram ${isValid ? 'валидны' : 'невалидны'}`);
    return isValid;
  }
}