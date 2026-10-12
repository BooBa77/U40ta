import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InventoryBookItem } from './inventory-book-item.entity';

/**
 * Сущность доступа МОЛа к строкам инвентаризационной книги.
 * 
 * Определяет, какие строки книги (inventory_book_items) доступны
 * конкретному МОЛу для просмотра и работы.
 * 
 * Составной первичный ключ: user_id + inventory_book_item_id.
 * При удалении пользователя или строки книги записи удаляются каскадно.
 */
@Entity('inventory_book_mol_access')
@Index('idx_mol_access_user', ['userId'])
@Index('idx_mol_access_item', ['inventoryBookItemId'])
export class InventoryBookMolAccess {
  /**
   * ID пользователя-МОЛа.
   * FK к users.id с каскадным удалением.
   */
  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /**
   * ID строки инвентаризационной книги.
   * FK к inventory_book_items.id с каскадным удалением.
   */
  @PrimaryColumn({ name: 'inventory_book_item_id', type: 'bigint' })
  inventoryBookItemId!: number;

  /**
   * Связи объявлены только ради имён внешних ключей в боевой базе
   * (`fk_mol_access_user`, `fk_mol_access_item`) — иначе TypeORM
   * предложит пересоздать ограничения под именами-хешами.
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_mol_access_user' })
  user!: User;

  @ManyToOne(() => InventoryBookItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_book_item_id', foreignKeyConstraintName: 'fk_mol_access_item' })
  item!: InventoryBookItem;
}