import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Сущность строки инвентаризационной ведомости.
 * 
 * Создаётся при парсинге Excel-файла, полученного от ревизора.
 * 
 * Позже ревизор в админке объединяет выбранные строки в сводную
 * инвентаризационную ведомость (inventory_sheets), где добавляются
 * отметки о проверке и связь с объектами учёта.
 */
@Entity('inventory_statements', {
  comment: 'Строки инвентаризационных ведомостей, полученные при парсинге Excel-файлов из писем ревизоров',
})
@Index('idx_inventory_email_from', ['emailFrom'])
@Index('idx_inventory_inv_number', ['invNumber'])
@Index('idx_inventory_zavod_sklad', ['zavod', 'sklad'])
// В базе это (received_at DESC NULLS LAST): направление сортировки TypeORM
// в @Index не выражает, но индекс опознаётся по имени и колонкам, поэтому
// здесь он остаётся ровно тем, что есть в базе.
@Index('idx_inventory_received_at', ['receivedAt'])
export class InventoryStatement {
  /**
   * Первичный ключ, автоинкремент.
   */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /**
   * Email отправителя — ревизора.
   * Используется для фильтрации: ревизор видит только свои ведомости.
   */
  @Column({ name: 'email_from', type: 'varchar', length: 500, comment: 'Email отправителя (ревизора)' })
  emailFrom!: string;

  /**
   * Дата и время получения письма.
   * Автоматически устанавливается при создании записи.
   */
  @Column({
    name: 'received_at',
    type: 'timestamp without time zone',
    nullable: true,
    default: () => 'now()',
    comment: 'Дата и время получения письма',
  })
  receivedAt!: Date;

  /**
   * Тип документа: 'ОСВ' (оборотно-сальдовая ведомость) или 'ОС' (основные средства).
   * Определяется при парсинге Excel по набору колонок.
   */
  @Column({ name: 'doc_type', type: 'varchar', length: 10, comment: 'Тип документа: ОСВ или ОС' })
  docType!: string;

  /**
   * Номер завода.
   * Для ОС всегда 0.
   */
  @Column({ name: 'zavod', type: 'integer', comment: 'Номер завода. Для ОС всегда 0' })
  zavod!: number;

  /**
   * Код склада.
   * Для ОСВ — из колонки "Склад", для ОС — из колонки "МОЛ".
   */
  @Column({ name: 'sklad', type: 'varchar', length: 8, comment: 'Код склада' })
  sklad!: string;

  /**
   * Инвентарный номер объекта.
   */
  @Column({ name: 'inv_number', type: 'varchar', length: 255, comment: 'Инвентарный номер объекта' })
  invNumber!: string;

  /**
   * Номер партии.
   * Может быть "-" для основных средств.
   */
  @Column({
    name: 'party_number',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Номер партии. Может быть NULL для основных средств',
  })
  partyNumber!: string;

  /**
   * Бухгалтерское наименование объекта.
   */
  @Column({ name: 'buh_name', type: 'text', comment: 'Бухгалтерское наименование объекта' })
  buhName!: string;
}