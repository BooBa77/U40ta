import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Сущность инвентаризационной книги.
 * 
 * Книга — это рабочий инструмент ревизора, сводная ведомость,
 * которую он формирует из выбранных batch'ей (строк inventory_statements).
 * 
 * Строки книги (InventoryBookItem) создаются копированием из inventory_statements
 * и живут независимо — исходные batch'и могут быть удалены.
 * 
 * Связи:
 * - OneToMany к InventoryBookItem (каскадное удаление)
 * - OneToMany к RevisorAccess (каскадное удаление)
 */
@Entity('inventory_books')
export class InventoryBook {
  /**
   * Первичный ключ, автоинкремент.
   */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /**
   * Название книги.
   * Задаётся ревизором при создании.
   */
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  /**
   * Дата и время создания книги.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  /**
   * ID пользователя, создавшего книгу.
   */
  @Column({ name: 'id_owner', type: 'bigint' })
  idOwner!: number;

  /**
   * Владелец книги. Связь объявлена ради имени внешнего ключа в боевой базе
   * (`inventory_books_id_owner_fkey`) — иначе TypeORM предложит пересоздать
   * ограничение под именем-хешем.
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_owner', foreignKeyConstraintName: 'inventory_books_id_owner_fkey' })
  owner!: User;
}