import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Сущность строки инвентаризационной книги.
 * 
 * Самостоятельный снимок данных на момент добавления в книгу.
 * Не зависит от inventory_statements — исходные batch'и могут быть удалены.
 * 
 * Поля проверки заполняются ревизорами в процессе инвентаризации.
 */
@Entity('inventory_book_items')
export class InventoryBookItem {
  /**
   * Первичный ключ, автоинкремент.
   */
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Ссылка на книгу, к которой относится строка.
   * FK к inventory_books.id с каскадным удалением.
   */
  @Column({ name: 'id_book', type: 'int' })
  idBook!: number;

  /**
   * Ссылка на исходную строку inventory_statements.
   * Не FK — исходная строка может быть удалена.
   */
  @Column({ name: 'id_inventory_statement', type: 'int', nullable: true })
  idInventoryStatement!: number | null;

  // ---- Поля-снимки из inventory_statements ----

  @Column({ name: 'zavod', type: 'integer' })
  zavod!: number;

  @Column({ name: 'sklad', type: 'varchar', length: 8 })
  sklad!: string;

  @Column({ name: 'inv_number', type: 'varchar', length: 255 })
  invNumber!: string;

  @Column({ name: 'party_number', type: 'varchar', length: 255, nullable: true })
  partyNumber!: string | null;

  @Column({ name: 'buh_name', type: 'text' })
  buhName!: string;

  // ---- Ссылка на объект учёта ----

  /**
   * Ссылка на объект учёта (objects.id).
   * Может быть NULL, если объект не найден в системе.
   */
  @Column({ name: 'id_object', type: 'int', nullable: true })
  idObject!: number | null;

  // ---- Поля-снимки из objects на момент проверки ----

  @Column({ name: 'place_ter', type: 'varchar', length: 100, nullable: true })
  placeTer!: string | null;

  @Column({ name: 'place_pos', type: 'varchar', length: 100, nullable: true })
  placePos!: string | null;

  @Column({ name: 'place_cab', type: 'varchar', length: 100, nullable: true })
  placeCab!: string | null;

  @Column({ name: 'place_user', type: 'varchar', length: 100, nullable: true })
  placeUser!: string | null;

  // ---- Поля проверки ----

  /**
   * Пропустить позицию (не участвует в инвентаризации).
   */
  @Column({ name: 'is_ignore', type: 'boolean', default: false })
  isIgnore!: boolean;

  /**
   * Ручное подтверждение наличия.
   */
  @Column({ name: 'is_ok_manual', type: 'boolean', default: false })
  isOkManual!: boolean;

  /**
   * ID пользователя, выполнившего ручное подтверждение.
   */
  @Column({ name: 'id_user_ok_manual_checked', type: 'int', nullable: true })
  idUserOkManualChecked!: number | null;

  /**
   * Дата и время ручного подтверждения.
   */
  @Column({ name: 'date_ok_manual_checked', type: 'timestamptz', nullable: true })
  dateOkManualChecked!: Date | null;

  /**
   * Автоматическое подтверждение (по данным системы).
   */
  @Column({ name: 'is_ok_auto', type: 'boolean', default: false })
  isOkAuto!: boolean;

  /**
   * ID пользователя, выполнившего автоматическое подтверждение.
   */
  @Column({ name: 'id_user_ok_auto_checked', type: 'bigint', nullable: true })
  idUserOkAutoChecked!: number | null;

  /**
   * Дата и время автоматического подтверждения.
   */
  @Column({ name: 'date_ok_auto_checked', type: 'timestamptz', nullable: true })
  dateOkAutoChecked!: Date | null;

  /**
   * Примечание ревизора.
   */
  @Column({ name: 'rem', type: 'text', nullable: true })
  rem!: string | null;
}