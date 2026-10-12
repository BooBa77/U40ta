import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Частичный индекс: активные объекты (не списанные) по заводу и складу.
 * Условие WHERE указано так же, как в боевой базе, иначе TypeORM будет
 * пересоздавать индекс.
 */
@Entity('objects')
@Index('idx_objects_zavod_sklad_active', ['zavod', 'sklad'], { where: 'is_written_off = false' })
export class InventoryObject {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'zavod', type: 'int', nullable: false, comment: 'Код завода' })
  zavod!: number;

  @Column({ name: 'sklad', type: 'varchar', length: 8, nullable: false, comment: 'Код склада' })
  sklad!: string;

  @Column({ name: 'buh_name', type: 'varchar', length: 255, nullable: false, comment: 'Бухгалтерское наименование объекта' })
  buhName!: string;

  @Column({ name: 'inv_number', type: 'varchar', length: 255, nullable: false, comment: 'Инвентарный номер' })
  invNumber!: string;

  @Column({
    name: 'party_number',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Номер партии. Может быть NULL для основных средств',
  })
  partyNumber!: string;

  @Column({ name: 'sn', type: 'varchar', length: 100, nullable: true, comment: 'Серийный номер' })
  sn!: string | null;

  @Column({
    name: 'is_written_off',
    type: 'boolean',
    nullable: true,
    default: false,
    comment: 'Флаг списания объекта. TRUE = списан, FALSE = активен',
  })
  isWrittenOff!: boolean;

  @Column({
    name: 'checked_at',
    type: 'date',
    nullable: true,
    default: () => 'CURRENT_DATE',
    comment: 'Дата последнего подтверждения наличия (без времени)',
  })
  checkedAt!: Date;

  @Column({ name: 'place_ter', type: 'varchar', length: 100, nullable: true, comment: 'Территория/площадка' })
  placeTer!: string | null;

  @Column({ name: 'place_pos', type: 'varchar', length: 100, nullable: true, comment: 'Позиция/здание' })
  placePos!: string | null;

  @Column({ name: 'place_cab', type: 'varchar', length: 100, nullable: true, comment: 'Кабинет/помещение' })
  placeCab!: string | null;

  @Column({ name: 'place_user', type: 'varchar', length: 100, nullable: true, comment: 'Пользователь' })
  placeUser!: string | null;

  @Column({ name: 'rem', type: 'text', nullable: true, comment: 'Комментарий' })
  rem!: string | null;  
}