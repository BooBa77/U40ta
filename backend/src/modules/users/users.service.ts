import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByTelegramUserId(telegramUserId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { telegramUserId },
      relations: ['telegramUser']
    });
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    // Ищем через связь с telegram_users
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.telegramUser', 'telegramUser')
      .where('telegramUser.telegram_id = :telegramId', { telegramId })
      .getOne();
  }

  async findById(id: number): Promise<User | null> {
  return this.usersRepository.findOne({
    where: { id }
  });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}