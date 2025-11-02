import { Injectable, Logger } from '@nestjs/common';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';
import { TelegramUser } from '../../telegram-users/entities/telegram-user.entity';

// @Injectable() - декоратор, который отмечает класс как провайдер
// NestJS сможет управлять его жизненным циклом и внедрять как зависимость
// TelegramAuthService отвечает за бизнес-логику работы с Telegram заявками
@Injectable()
export class TelegramAuthService {
  // Создаем логгер для этого сервиса с именем класса для идентификации
  private readonly logger = new Logger(TelegramAuthService.name);

  // Конструктор с внедрением TelegramUsersService
  // TelegramUsersService предоставляет низкоуровневые CRUD операции с БД
  constructor(
    private telegramUsersService: TelegramUsersService,
  ) {}

  /**
   * Основной метод для обработки логики Telegram авторизации
   * Создает новую заявку или возвращает существующую
   * Этот метод инкапсулирует бизнес-логику "найти или создать"
   * 
   * @param telegramData - данные от Telegram Web App
   * @returns объект с пользователем и флагом isNew (была ли создана новая заявка)
   */
  async createOrFind(telegramData: any): Promise<{ user: TelegramUser; isNew: boolean }> {
    this.logger.log(`Обработка Telegram данных для пользователя: ${telegramData.first_name}`);
    
    // Пытаемся найти существующую заявку по telegram_id
    // telegramData.id - это уникальный идентификатор пользователя в Telegram
    let telegramUser = await this.telegramUsersService.findByTelegramId(telegramData.id);
    let isNew = false;

    // Если пользователь не найден в таблице telegram_users - создаем новую заявку
    if (!telegramUser) {
      this.logger.log(`Создание новой заявки для Telegram ID: ${telegramData.id}`);
      
      // Создаем новую заявку с данными из Telegram
      // Используем TelegramUsersService для низкоуровневой операции создания
      telegramUser = await this.telegramUsersService.create({
        telegram_id: telegramData.id,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name || null,  // Фамилия может отсутствовать
        username: telegramData.username || null,    // Username может отсутствовать
      });
      isNew = true; // Устанавливаем флаг что заявка новая
      
      this.logger.log(`Новая заявка создана с ID: ${telegramUser.id}`);
    } else {
      // Если заявка уже существует - просто логируем этот факт
      this.logger.log(`Найдена существующая заявка с ID: ${telegramUser.id}`);
    }

    // Возвращаем объект с пользователем и информацией о том, новая ли это заявка
    // Это позволяет вызывающему коду (AuthService) знать контекст операции
    return {
      user: telegramUser,
      isNew: isNew
    };
  }
}