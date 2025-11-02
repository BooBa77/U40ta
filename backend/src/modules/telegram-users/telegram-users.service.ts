import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUser } from './entities/telegram-user.entity';

// @Injectable() - декоратор, который отмечает класс как провайдер (сервис)
// NestJS сможет управлять его жизненным циклом и внедрять зависимости
@Injectable()
export class TelegramUsersService {
  private readonly logger = new Logger(TelegramUsersService.name);

  // Конструктор с внедрением зависимостей через декоратор @InjectRepository
  // @InjectRepository(TelegramUser) - говорит NestJS внедрить репозиторий для сущности TelegramUser
  // Repository<TelegramUser> - TypeORM репозиторий для работы с таблицей telegram_users в БД
  constructor(
    @InjectRepository(TelegramUser)
    private usersRepository: Repository<TelegramUser>,
  ) {}

  // Поиск пользователя по telegram_id (уникальный идентификатор из Telegram)
  async findByTelegramId(telegramId: number): Promise<TelegramUser | null> {
    this.logger.log(`Поиск пользователя по Telegram ID: ${telegramId}`);
    
    // Ищем пользователя в таблице по полю telegram_id
    const user = await this.usersRepository.findOne({
      where: { telegram_id: telegramId }
    });
    
    if (user) {
      this.logger.log(`Пользователь с Telegram ID ${telegramId} найден`);
    } else {
      this.logger.log(`Пользователь с Telegram ID ${telegramId} не найден`);
    }
    
    return user;
  }

  // Создание нового пользователя (заявки) в таблице telegram_users
  async create(createUserDto: any): Promise<TelegramUser> {
    this.logger.log('Создание нового пользователя Telegram');
    this.logger.debug(`Данные для создания: ${JSON.stringify(createUserDto)}`);
    
    // Создаем новый экземпляр сущности TelegramUser
    // Явное создание объекта помогает избежать проблем с типами и обеспечивает контроль над данными
    const user = new TelegramUser();
    user.telegram_id = createUserDto.telegram_id;
    user.first_name = createUserDto.first_name;
    user.last_name = createUserDto.last_name || null;  // Если фамилия не указана, сохраняем null
    user.username = createUserDto.username || null;    // Если username не указан, сохраняем null
    
    // Сохраняем пользователя в базу данных
    // usersRepository.save() выполняет INSERT запрос к PostgreSQL
    const savedUser = await this.usersRepository.save(user);
    
    this.logger.log(`Пользователь создан с ID: ${savedUser.id}`);
    return savedUser;
  }

  // Получить всех пользователей из таблицы telegram_users
  async findAll(): Promise<TelegramUser[]> {
    this.logger.log('Запрос на получение всех пользователей Telegram');
    
    // usersRepository.find() выполняет SELECT * FROM telegram_users
    const users = await this.usersRepository.find();
    
    this.logger.log(`Найдено пользователей: ${users.length}`);
    return users;
  }

  // Найти пользователя по внутреннему ID (первичный ключ в таблице)
  async findById(id: number): Promise<TelegramUser> {
    this.logger.log(`Поиск пользователя по внутреннему ID: ${id}`);
    
    // Ищем пользователя по полю id (автоинкрементный первичный ключ)
    const user = await this.usersRepository.findOne({ where: { id } });
    
    if (!user) {
      this.logger.warn(`Пользователь с ID ${id} не найден`);
      // NotFoundException автоматически преобразуется в HTTP 404 ответ
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    this.logger.log(`Пользователь с ID ${id} найден`);
    return user;
  }

  // Обновить данные пользователя
  async update(id: number, updateData: any): Promise<TelegramUser> {
    this.logger.log(`Обновление пользователя с ID: ${id}`);
    this.logger.debug(`Данные для обновления: ${JSON.stringify(updateData)}`);
    
    // Сначала проверяем, существует ли пользователь
    // findById выбросит NotFoundException если пользователь не найден
    await this.findById(id);
    
    // Выполняем UPDATE запрос к базе данных
    await this.usersRepository.update(id, updateData);
    
    // Получаем обновленного пользователя чтобы вернуть актуальные данные
    const updatedUser = await this.findById(id);
    
    this.logger.log(`Пользователь с ID ${id} успешно обновлен`);
    return updatedUser;
  }

  // Удалить пользователя из таблицы telegram_users
  async remove(id: number): Promise<void> {
    this.logger.log(`Удаление пользователя с ID: ${id}`);
    
    // Проверяем, существует ли пользователь перед удалением
    await this.findById(id);
    
    // Выполняем DELETE запрос к базе данных
    await this.usersRepository.delete(id);
    
    this.logger.log(`Пользователь с ID ${id} успешно удален`);
  }
}