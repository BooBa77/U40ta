import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryBook } from './inventory-book.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Сущность доступа ревизора к инвентаризационной книге.
 * 
 * Определяет, какие ревизоры имеют доступ к конкретной книге.
 * Все ревизоры с доступом видят и редактируют строки книги совместно.
 * 
 * Составной первичный ключ: id_book + user_id.
 * При удалении книги записи удаляются каскадно.
 */
@Entity('revisor_access')
export class RevisorAccess {
  /**
   * Ссылка на книгу.
   * FK к inventory_books.id с каскадным удалением.
   */
  @PrimaryColumn({ name: 'id_book', type: 'bigint' })
  idBook!: number;

  /**
   * ID пользователя-ревизора.
   * FK к users.id.
   */
  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /**
   * Связи объявлены ради имён внешних ключей в боевой базе
   * (`revisor_access_id_book_fkey`, `revisor_access_user_id_fkey`).
   */
  @ManyToOne(() => InventoryBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_book', foreignKeyConstraintName: 'revisor_access_id_book_fkey' })
  book!: InventoryBook;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'revisor_access_user_id_fkey' })
  user!: User;
}