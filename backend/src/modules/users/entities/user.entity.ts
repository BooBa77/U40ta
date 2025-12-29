import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'telegram_id', nullable: true, unique: true })
  telegramId: number;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column()
  abr: string;

  @Column()
  role: string;
}