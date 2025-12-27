import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('mol_access')
export class MolAccess {
  // Составной первичный ключ
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @PrimaryColumn()
  zavod: number;

  @PrimaryColumn({ length: 4 })
  sklad: string;

  // Связь с пользователем
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}