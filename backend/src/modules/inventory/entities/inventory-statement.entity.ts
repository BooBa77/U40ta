import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Сущность строки инвентаризационной ведомости.
 * 
 * Создаётся при парсинге Excel-файла, полученного от ревизора.
 * 
 * Позже ревизор в админке объединяет выбранные строки в сводную
 * инвентаризационную ведомость (inventory_sheets), где добавляются
 * отметки о проверке и связь с объектами учёта.
 */
@Entity('inventory_statements')
export class InventoryStatement {
  /**
   * Первичный ключ, автоинкремент.
   */
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Email отправителя — ревизора.
   * Используется для фильтрации: ревизор видит только свои ведомости.
   */
  @Column({ name: 'email_from', type: 'varchar', length: 500 })
  emailFrom!: string;

  /**
   * Дата и время получения письма.
   * Автоматически устанавливается при создании записи.
   */
  @CreateDateColumn({ name: 'received_at' })
  receivedAt!: Date;

  /**
   * Тип документа: 'ОСВ' (оборотно-сальдовая ведомость) или 'ОС' (основные средства).
   * Определяется при парсинге Excel по набору колонок.
   */
  @Column({ name: 'doc_type', type: 'varchar', length: 10 })
  docType!: string;

  /**
   * Номер завода.
   * Для ОС всегда 0.
   */
  @Column({ name: 'zavod', type: 'integer' })
  zavod!: number;

  /**
   * Код склада.
   * Для ОСВ — из колонки "Склад", для ОС — из колонки "МОЛ".
   */
  @Column({ name: 'sklad', type: 'varchar', length: 8 })
  sklad!: string;

  /**
   * Инвентарный номер объекта.
   */
  @Column({ name: 'inv_number', type: 'varchar', length: 255 })
  invNumber!: string;

  /**
   * Номер партии.
   * Может быть NULL для основных средств.
   */
  @Column({ name: 'party_number', type: 'varchar', length: 255, nullable: true })
  partyNumber!: string | null;

  /**
   * Бухгалтерское наименование объекта.
   */
  @Column({ name: 'buh_name', type: 'text' })
  buhName!: string;
}