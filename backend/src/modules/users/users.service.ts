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

  async findByTelegramUserId(telegramUsersId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { telegramUsersId },
    });
  }

  async findByTelegramId(telegramUsersId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { telegramUsersId: telegramUsersId }
    });
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