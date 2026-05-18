import { Entity, PrimaryColumn, Column } from 'typeorm';

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
}