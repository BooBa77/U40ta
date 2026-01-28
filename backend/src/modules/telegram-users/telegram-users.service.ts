import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUser } from './entities/telegram-user.entity';
import { CreateTelegramUserDto } from './dto/create-telegram-user.dto';
import { UpdateTelegramUserDto } from './dto/update-telegram-user.dto';

@Injectable()
export class TelegramUsersService {
  private readonly logger = new Logger(TelegramUsersService.name);

  constructor(
    @InjectRepository(TelegramUser)
    private usersRepository: Repository<TelegramUser>,
  ) {}

  /**
   * Создание нового пользователя Telegram
   * Используется при первой авторизации через Telegram
   */
  async create(createTelegramUserDto: CreateTelegramUserDto): Promise<TelegramUser> {
    this.logger.log(`Создание пользователя Telegram: ${createTelegramUserDto.telegram_id}`);
    
    const user = this.usersRepository.create(createTelegramUserDto);
    const savedUser = await this.usersRepository.save(user);
    
    this.logger.log(`Пользователь Telegram создан с ID: ${savedUser.id}`);
    return savedUser;
  }

  /**
   * Поиск пользователя по telegram_id
   * telegram_id - уникальный идентификатор из Telegram
   */
  async findByTelegramId(telegramId: number): Promise<TelegramUser | null> {
    this.logger.log(`Поиск пользователя Telegram по ID: ${telegramId}`);
    
    const user = await this.usersRepository.findOne({
      where: { telegram_id: telegramId }
    });
    
    this.logger.log(`Пользователь Telegram ${user ? 'найден' : 'не найден'}`);
    return user;
  }

  /**
   * Поиск пользователя по внутреннему ID
   */
  async findById(id: number): Promise<TelegramUser> {
    this.logger.log(`Поиск пользователя Telegram по внутреннему ID: ${id}`);
    
    const user = await this.usersRepository.findOne({ where: { id } });
    
    if (!user) {
      this.logger.warn(`Пользователь Telegram с ID ${id} не найден`);
      throw new NotFoundException(`TelegramUser with ID ${id} not found`);
    }
    
    return user;
  }

  /**
   * Получение всех пользователей Telegram
   */
  async findAll(): Promise<TelegramUser[]> {
    this.logger.log('Запрос всех пользователей Telegram');
    return this.usersRepository.find();
  }

  /**
   * Обновление данных пользователя Telegram
   */
  async update(id: number, updateTelegramUserDto: UpdateTelegramUserDto): Promise<TelegramUser> {
    this.logger.log(`Обновление пользователя Telegram с ID: ${id}`);
    
    await this.findById(id); // Проверка существования
    await this.usersRepository.update(id, updateTelegramUserDto);
    
    const updatedUser = await this.findById(id);
    this.logger.log(`Пользователь Telegram с ID ${id} обновлен`);
    
    return updatedUser;
  }

  /**
   * Удаление пользователя Telegram
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`Удаление пользователя Telegram с ID: ${id}`);
    
    await this.findById(id); // Проверка существования
    await this.usersRepository.delete(id);
    
    this.logger.log(`Пользователь Telegram с ID ${id} удален`);
  }

  /**
   * Найти или создать пользователя Telegram
   * Утилитарный метод для упрощения работы в AuthService
   */
  async findOrCreate(telegramId: number, userData: Partial<CreateTelegramUserDto>): Promise<TelegramUser> {
    this.logger.log(`Поиск или создание пользователя Telegram: ${telegramId}`);
    
    let user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      this.logger.log(`Создание нового пользователя Telegram: ${telegramId}`);
      const createDto: CreateTelegramUserDto = {
        telegram_id: telegramId,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
      };
      user = await this.create(createDto);
    }
    
    return user;
  }
}