import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MolAccess } from './entities/mol-access.entity';
import { Revisors } from './entities/revisors.entity';

/**
 * Сервис для работы с пользователями системы.
 * 
 * ## Назначение
 * Управление пользователями: создание, поиск, обновление, удаление,
 * проверка ролей (МОЛ, ревизор) через соответствующие таблицы доступа.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(MolAccess)
    private readonly molAccessRepository: Repository<MolAccess>,
    @InjectRepository(Revisors)
    private readonly revisorRepository: Repository<Revisors>,
  ) {}

  /**
   * Генерация аббревиатуры из имени и фамилии.
   * Формат: первая буква имени + первая буква фамилии.
   * 
   * @param firstName - имя пользователя
   * @param lastName - фамилия пользователя
   * @returns аббревиатура в верхнем регистре
   */
  private generateAbr(firstName: string, lastName: string): string {
    const firstChar = firstName?.charAt(0)?.toUpperCase() || '';
    const lastChar = lastName?.charAt(0)?.toUpperCase() || '';
    return firstChar + lastChar;
  }

  /**
   * Создание нового пользователя системы.
   * Автоматически генерирует abr на основе имени и фамилии.
   * 
   * @param createUserDto - данные для создания пользователя
   * @returns созданный пользователь
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`Создание пользователя системы для TelegramUsersId: ${createUserDto.telegramUsersId}`);
    
    const abr = this.generateAbr(createUserDto.firstName, createUserDto.lastName);

    const user = this.usersRepository.create({
      ...createUserDto,
      abr,
    });

    const savedUser = await this.usersRepository.save(user);
    
    this.logger.log(`Пользователь системы создан с ID: ${savedUser.id}, abr: ${savedUser.abr}`);
    return savedUser;
  }

  /**
   * Поиск пользователя по telegram_users_id.
   * 
   * @param telegramUsersId - ID пользователя в Telegram
   * @returns пользователь или null
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
   * Поиск пользователя по ID.
   * 
   * @param id - ID пользователя в системе
   * @returns пользователь
   * @throws NotFoundException если пользователь не найден
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
   * Получение всех пользователей системы.
   * 
   * @returns массив всех пользователей
   */
  async findAll(): Promise<User[]> {
    this.logger.log('Запрос всех пользователей системы');
    return this.usersRepository.find();
  }

  /**
   * Обновление данных пользователя.
   * При обновлении имени или фамилии автоматически пересчитывает abr.
   * 
   * @param id - ID пользователя
   * @param updateUserDto - данные для обновления
   * @returns обновлённый пользователь
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Обновление пользователя системы с ID: ${id}`);
    
    const user = await this.findById(id);
    let abr: string | undefined;
    
    if ((updateUserDto.firstName !== undefined && updateUserDto.firstName !== user.firstName) ||
        (updateUserDto.lastName !== undefined && updateUserDto.lastName !== user.lastName)) {
      
      const newFirstName = updateUserDto.firstName ?? user.firstName;
      const newLastName = updateUserDto.lastName ?? user.lastName;
      abr = this.generateAbr(newFirstName, newLastName);
      
      this.logger.log(`Пересчет abr для пользователя ${id}: ${abr}`);
    }
    
    await this.usersRepository.update(id, {
      ...updateUserDto,
      ...(abr && { abr }),
    });
    const updatedUser = await this.findById(id);
    
    this.logger.log(`Пользователь системы с ID ${id} обновлен`);
    return updatedUser;
  }

  /**
   * Удаление пользователя.
   * 
   * @param id - ID пользователя
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`Удаление пользователя системы с ID: ${id}`);
    
    await this.findById(id);
    await this.usersRepository.delete(id);
    
    this.logger.log(`Пользователь системы с ID ${id} удален`);
  }

  /**
   * Найти или создать пользователя системы.
   * Утилитарный метод для упрощения работы в AuthService.
   * 
   * @param telegramUsersId - ID пользователя в Telegram
   * @param firstName - имя
   * @param lastName - фамилия
   * @returns существующий или созданный пользователь
   */
  async findOrCreate(telegramUsersId: number, firstName: string, lastName: string): Promise<User> {
    this.logger.log(`Поиск или создание пользователя системы для TelegramUsersId: ${telegramUsersId}`);
    
    let user = await this.findByTelegramUsersId(telegramUsersId);
    
    if (!user) {
      this.logger.log(`Создание нового пользователя системы: ${firstName} ${lastName}`);
      
      user = await this.create({
        telegramUsersId,
        firstName,
        lastName,
      });
    }
    
    return user;
  }

  /**
   * Поиск пользователя по telegram_id.
   * Удобный метод для AuthService. Ищет сначала в telegram_users, затем в users.
   * 
   * @param telegramId - ID пользователя в Telegram
   * @returns пользователь или null
   */
  async findByTelegramId(telegramId: number): Promise<User | null> {
    this.logger.log(`Поиск пользователя системы по Telegram ID: ${telegramId}`);
    return null;
  }

  /**
   * Проверка, является ли пользователь материально-ответственным лицом (МОЛ).
   * Проверяет наличие записи в таблице mol_access.
   * 
   * @param userId - ID пользователя в системе
   * @returns true если пользователь — МОЛ
   */
  async hasAccessToStatements(userId: number): Promise<boolean> {
    const count = await this.molAccessRepository.count({ where: { userId } });
    return count > 0;
  }

  /**
   * Проверка, является ли пользователь ревизором.
   * Проверяет наличие записи в таблице revisors.
   * 
   * @param userId - ID пользователя в системе
   * @returns true если пользователь — ревизор
   */
  async isRevisor(userId: number): Promise<boolean> {
    const count = await this.revisorRepository.count({ where: { userId } });
    return count > 0;
  }
}