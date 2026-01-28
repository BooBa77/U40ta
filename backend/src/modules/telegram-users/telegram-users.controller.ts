import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, NotFoundException, Logger, UseGuards } from '@nestjs/common';
import { CreateTelegramUserDto } from './dto/create-telegram-user.dto';
import { UpdateTelegramUserDto } from './dto/update-telegram-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// @Controller('telegram-users') - декоратор, который определяет базовый путь для всех маршрутов в этом контроллере
// Все HTTP запросы, начинающиеся с /telegram-users, будут обрабатываться этим контроллере
@Controller('telegram-users')
@UseGuards(JwtAuthGuard)
export class TelegramUsersController {
  // Создаем экземпляр логгера для этого контроллера
  // Имя 'TelegramUsersController' будет отображаться в логах для идентификации источника
  private readonly logger = new Logger(TelegramUsersController.name);

  // Конструктор контроллера - NestJS автоматически внедряет TelegramUsersService
  // Это называется Dependency Injection (внедрение зависимостей)
  constructor(private readonly telegramUsersService: TelegramUsersService) {
    this.logger.log('TelegramUsersController инициализирован');
  }

  // @Get() - обрабатывает GET запросы на /telegram-users
  // Возвращает массив всех заявок из таблицы telegram_users
  @Get()
  findAll(): Promise<TelegramUser[]> {
    this.logger.log('Выполняется запрос на получение всех заявок пользователей Telegram');
    
    // Вызываем метод сервиса, который содержит бизнес-логику получения данных
    return this.telegramUsersService.findAll();
  }

  // @Get(':id') - обрабатывает GET запросы на /telegram-users/123
  // где 123 - это id заявки
  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<TelegramUser> {
    this.logger.log(`Выполняется запрос на получение заявки с ID: ${id}`);
    
    // ParseIntPipe автоматически преобразует параметр из строки в число
    // и возвращает ошибку 400 если преобразование невозможно
    
    const user = await this.telegramUsersService.findById(id);
    
    // Если пользователь не найден, выбрасываем исключение NotFoundException
    // NestJS автоматически преобразует его в HTTP 404 ответ
    if (!user) {
      this.logger.warn(`Заявка с ID ${id} не найдена`);
      throw new NotFoundException(`TelegramUser with ID ${id} not found`);
    }
    
    this.logger.log(`Заявка с ID ${id} успешно найдена`);
    return user;
  }

  // @Get('telegram/:telegramId') - обрабатывает GET запросы на /telegram-users/telegram/123456
  // где 123456 - это telegram_id пользователя (из данных Telegram)
  @Get('telegram/:telegramId')
  async findByTelegramId(@Param('telegramId', ParseIntPipe) telegramId: number): Promise<TelegramUser> {
    this.logger.log(`Выполняется запрос на получение заявки с Telegram ID: ${telegramId}`);
    
    // Ищем заявку по telegram_id (уникальный идентификатор из Telegram)
    const user = await this.telegramUsersService.findByTelegramId(telegramId);
    
    if (!user) {
      this.logger.warn(`Заявка с Telegram ID ${telegramId} не найдена`);
      throw new NotFoundException(`TelegramUser with Telegram ID ${telegramId} not found`);
    }
    
    this.logger.log(`Заявка с Telegram ID ${telegramId} успешно найдена`);
    return user;
  }

  // @Post() - обрабатывает POST запросы на /telegram-users
  // Создает новую заявку пользователя
  @Post()
  async create(@Body() userData: CreateTelegramUserDto): Promise<TelegramUser> {
    // Было: Partial<TelegramUser>
    // Стало: CreateTelegramUserDto
    this.logger.log('Создание новой заявки пользователя Telegram');
    
    const createdUser = await this.telegramUsersService.create(userData);
    
    this.logger.log(`Новая заявка создана с ID: ${createdUser.id}`);
    return createdUser;
  }

  // @Put(':id') - обрабатывает PUT запросы на /telegram-users/123
  // Полностью обновляет заявку с указанным id
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number, // ID из URL параметра
    @Body() userData: UpdateTelegramUserDto, // Данные для обновления из тела запроса
  ): Promise<TelegramUser> {
    this.logger.log(`Выполняется запрос на обновление заявки с ID: ${id}`);
    
    const updatedUser = await this.telegramUsersService.update(id, userData);
    
    this.logger.log(`Заявка с ID ${id} успешно обновлена`);
    return updatedUser;
  }

  // @Delete(':id') - обрабатывает DELETE запросы на /telegram-users/123
  // Удаляет заявку с указанным id
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`Выполняется запрос на удаление заявки с ID: ${id}`);
    
    await this.telegramUsersService.remove(id);
    
    this.logger.log(`Заявка с ID ${id} успешно удалена`);
  }
}