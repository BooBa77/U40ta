import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Генерация аббревиатуры из имени и фамилии
   * Формат: первая буква имени + первая буква фамилии
   */
  private generateAbr(firstName: string, lastName: string): string {
    const firstChar = firstName?.charAt(0)?.toUpperCase() || '';
    const lastChar = lastName?.charAt(0)?.toUpperCase() || '';
    return firstChar + lastChar;
  }

  /**
   * Создание нового пользователя системы
   * Автоматически генерирует abr на основе имени и фамилии
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`Создание пользователя системы для TelegramUsersId: ${createUserDto.telegramUsersId}`);
    
    // Генерация abr если не предоставлен
    if (!createUserDto.abr) {
      createUserDto.abr = this.generateAbr(createUserDto.firstName, createUserDto.lastName);
    }
    
    const user = this.usersRepository.create(createUserDto);
    const savedUser = await this.usersRepository.save(user);
    
    this.logger.log(`Пользователь системы создан с ID: ${savedUser.id}, abr: ${savedUser.abr}`);
    return savedUser;
  }

  /**
   * Поиск пользователя по telegram_users_id
   */
  async findByTelegramUsersId(telegramUsersId: number): Promise<User | null> {
    this.logger.log(`Поиск пользователя системы по TelegramUsersId: ${telegramUsersId}`);
    
    const user = await this.usersRepository.findOne({
      where: { telegramUsersId },
    });
    
    this.logger.log(`Пользователь системы ${user ? 'найден' : 'не найден'}`);
    return user;
  }

  /**
   * Поиск пользователя по ID
   */
  async findById(id: number): Promise<User> {
    this.logger.log(`Поиск пользователя системы по ID: ${id}`);
    
    const user = await this.usersRepository.findOne({ where: { id } });
    
    if (!user) {
      this.logger.warn(`Пользователь системы с ID ${id} не найден`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return user;
  }

  /**
   * Получение всех пользователей системы
   */
  async findAll(): Promise<User[]> {
    this.logger.log('Запрос всех пользователей системы');
    return this.usersRepository.find();
  }

  /**
   * Обновление данных пользователя
   * При обновлении имени/фамилии автоматически пересчитывает abr
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Обновление пользователя системы с ID: ${id}`);
    
    const user = await this.findById(id);
    
    // Если обновляются имя или фамилия - пересчитываем abr
    if ((updateUserDto.firstName && updateUserDto.firstName !== user.firstName) ||
        (updateUserDto.lastName && updateUserDto.lastName !== user.lastName)) {
      
      const newFirstName = updateUserDto.firstName || user.firstName;
      const newLastName = updateUserDto.lastName || user.lastName;
      updateUserDto.abr = this.generateAbr(newFirstName, newLastName);
      
      this.logger.log(`Пересчет abr для пользователя ${id}: ${updateUserDto.abr}`);
    }
    
    await this.usersRepository.update(id, updateUserDto);
    const updatedUser = await this.findById(id);
    
    this.logger.log(`Пользователь системы с ID ${id} обновлен`);
    return updatedUser;
  }

  /**
   * Удаление пользователя
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`Удаление пользователя системы с ID: ${id}`);
    
    await this.findById(id); // Проверка существования
    await this.usersRepository.delete(id);
    
    this.logger.log(`Пользователь системы с ID ${id} удален`);
  }

  /**
   * Найти или создать пользователя системы
   * Утилитарный метод для упрощения работы в AuthService
   */
  async findOrCreate(telegramUsersId: number, firstName: string, lastName: string): Promise<User> {
    this.logger.log(`Поиск или создание пользователя системы для TelegramUsersId: ${telegramUsersId}`);
    
    let user = await this.findByTelegramUsersId(telegramUsersId);
    
    if (!user) {
      this.logger.log(`Создание нового пользователя системы: ${firstName} ${lastName}`);
      
      const createDto: CreateUserDto = {
        telegramUsersId,
        firstName,
        lastName,
        abr: this.generateAbr(firstName, lastName),
      };
      
      user = await this.create(createDto);
    }
    
    return user;
  }

  /**
   * Поиск пользователя по telegram_id (удобный метод для AuthService)
   * Ищет сначала в telegram_users, затем в users
   * Это метод для удобства, основная логика в AuthService
   */
  async findByTelegramId(telegramId: number): Promise<User | null> {
    this.logger.log(`Поиск пользователя системы по Telegram ID: ${telegramId}`);
    
    // Этот метод предполагает что у нас есть доступ к репозиторию telegram_users
    // В реальности лучше делать через AuthService
    // Оставляем как заглушку, будет реализовано в AuthService
    return null;
  }
}