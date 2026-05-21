import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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
  @PrimaryGeneratedColumn()
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
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /**
   * ID пользователя, создавшего книгу.
   */
  @Column({ name: 'id_owner', type: 'int' })
  idOwner!: number;
}