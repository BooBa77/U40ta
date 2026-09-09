import { Entity, PrimaryColumn } from 'typeorm';

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
}