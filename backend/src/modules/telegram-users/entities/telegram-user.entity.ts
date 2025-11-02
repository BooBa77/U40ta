import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('telegram_users')
export class TelegramUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegram_id: number;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ nullable: true })
  username: string;
}
