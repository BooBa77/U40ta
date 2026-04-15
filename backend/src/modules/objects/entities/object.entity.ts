import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('objects')
export class InventoryObject {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'zavod', type: 'int', nullable: false })
  zavod!: number;

  @Column({ name: 'sklad', type: 'varchar', length: 8, nullable: false })
  sklad!: string;

  @Column({ name: 'buh_name', type: 'varchar', length: 255, nullable: false })
  buhName!: string;

  @Column({ name: 'inv_number', type: 'varchar', length: 255, nullable: false })
  invNumber!: string;

  @Column({ name: 'party_number', type: 'varchar', length: 255, nullable: true })
  partyNumber!: string | null;

  @Column({ name: 'sn', type: 'varchar', length: 100, nullable: true })
  sn!: string | null;

  @Column({ name: 'is_written_off', type: 'boolean', default: false })
  isWrittenOff!: boolean;

  @Column({ name: 'checked_at', type: 'date', default: () => 'CURRENT_DATE' })
  checkedAt!: Date;

  @Column({ name: 'place_ter', type: 'varchar', length: 100, nullable: true })
  placeTer!: string | null;

  @Column({ name: 'place_pos', type: 'varchar', length: 100, nullable: true })
  placePos!: string | null;

  @Column({ name: 'place_cab', type: 'varchar', length: 100, nullable: true })
  placeCab!: string | null;

  @Column({ name: 'place_user', type: 'varchar', length: 100, nullable: true })
  placeUser!: string | null;
}