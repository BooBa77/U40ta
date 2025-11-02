import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TelegramUser } from '../../telegram-users/entities/telegram-user.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'telegram_user_id', nullable: true })
  telegramUserId: number;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column()
  abr: string;

  @Column()
  role: string;

  // Связь с telegram_users
  @ManyToOne(() => TelegramUser)
  @JoinColumn({ name: 'telegram_user_id' })
  telegramUser: TelegramUser;
}