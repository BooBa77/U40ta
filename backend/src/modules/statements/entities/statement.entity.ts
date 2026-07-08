import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('statements')
export class Statement {
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID пользователя-владельца (МОЛ) */
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** Дата и время получения письма */
  @Column({ name: 'received_at', type: 'timestamp without time zone', default: () => 'now()' })
  receivedAt!: Date;

  /** Тип документа: ОСВ или ОС */
  @Column({ name: 'doc_type', type: 'varchar', length: 10 })
  docType!: string;

  /**
   * Описание ведомости, формируется при парсинге.
   * Примеры: "ОСВ s010,s017", "ОС s010"
   */
  @Column({ name: 'description', type: 'varchar', length: 500 })
  description!: string;

  /** Номер завода. Для ОС всегда 0 */
  @Column({ name: 'zavod', type: 'integer' })
  zavod!: number;

  /** Код склада */
  @Column({ name: 'sklad', type: 'varchar', length: 8 })
  sklad!: string;

  /** Инвентарный номер объекта */
  @Column({ name: 'inv_number', type: 'varchar', length: 255 })
  invNumber!: string;

  /** Номер партии. Для ОС всегда "-" */
  @Column({ name: 'party_number', type: 'varchar', length: 255, nullable: false, default: '-' })
  partyNumber!: string;

  /** Бухгалтерское наименование объекта */
  @Column({ name: 'buh_name', type: 'text' })
  buhName!: string;

  /** Флаг актуальности. false = неактуальная запись (игнорируется) */
  @Column({ name: 'is_actual', type: 'boolean', default: true })
  isActual!: boolean;
}