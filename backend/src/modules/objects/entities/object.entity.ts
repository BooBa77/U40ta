import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('objects')
export class InventoryObject {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'int', nullable: false })
  zavod: number;

  @Column({ type: 'varchar', length: 4, nullable: false })
  sklad: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  buh_name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  inv_number: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  party_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sn: string | null;

  @Column({ name: 'is_written_off', type: 'boolean', default: false })
  is_written_off: boolean;

  @Column({ 
    name: 'checked_at', 
    type: 'date', 
    default: () => 'CURRENT_DATE' 
  })
  checked_at: Date;

  // Место использования
  @Column({ name: 'place_ter', type: 'varchar', length: 100, nullable: true })
  place_ter: string | null;

  @Column({ name: 'place_pos', type: 'varchar', length: 100, nullable: true })
  place_pos: string | null;

  @Column({ name: 'place_cab', type: 'varchar', length: 100, nullable: true })
  place_cab: string | null;

  @Column({ name: 'place_user', type: 'varchar', length: 100, nullable: true })
  place_user: string | null;
}