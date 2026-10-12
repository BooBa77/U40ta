import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('statements', {
  comment: 'Строки ведомостей МОЛ, полученные при парсинге Excel-файлов из писем',
})
@Index('idx_statements_user_received', ['userId', 'receivedAt'])
export class Statement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** ID пользователя-владельца (МОЛ) */
  @Column({ name: 'user_id', type: 'integer', comment: 'ID пользователя-владельца (МОЛ)' })
  userId!: number;

  /** Дата и время получения письма */
  @Column({
    name: 'received_at',
    type: 'timestamp without time zone',
    nullable: true,
    default: () => 'now()',
    comment: 'Дата и время получения письма',
  })
  receivedAt!: Date;

  /** Тип документа: ОСВ или ОС */
  @Column({ name: 'doc_type', type: 'varchar', length: 10, comment: 'Тип документа: ОСВ или ОС' })
  docType!: string;

  /**
   * Описание ведомости, формируется при парсинге.
   * Примеры: "ОСВ s010,s017", "ОС s010"
   */
  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    comment: 'Описание ведомости, формируется при парсинге, например "ОСВ s010,s017"',
  })
  description!: string;

  /** Номер завода. Для ОС всегда 0 */
  @Column({ name: 'zavod', type: 'integer', comment: 'Номер завода. Для ОС всегда 0' })
  zavod!: number;

  /** Код склада */
  @Column({ name: 'sklad', type: 'varchar', length: 8, comment: 'Код склада' })
  sklad!: string;

  /** Инвентарный номер объекта */
  @Column({ name: 'inv_number', type: 'varchar', length: 255, comment: 'Инвентарный номер объекта' })
  invNumber!: string;

  /** Номер партии. Для ОС всегда "-" */
  @Column({
    name: 'party_number',
    type: 'varchar',
    length: 255,
    nullable: false,
    default: '-',
    comment: 'Номер партии. Может быть NULL для основных средств',
  })
  partyNumber!: string;

  /** Бухгалтерское наименование объекта */
  @Column({ name: 'buh_name', type: 'text', comment: 'Бухгалтерское наименование объекта' })
  buhName!: string;

  /** Флаг актуальности. false = неактуальная запись (игнорируется) */
  @Column({
    name: 'is_actual',
    type: 'boolean',
    nullable: true,
    default: true,
    comment: 'Флаг актуальности. false = неактуальная запись',
  })
  isActual!: boolean;
}