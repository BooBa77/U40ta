import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Place } from '../../places/entities/place.entity';

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
  sn: string;

  @Column({ type: 'bigint', nullable: true })
  place: number;

  @Column({ type: 'text', nullable: true })
  commentary: string;

  @Column({ name: 'is_written_off', type: 'boolean', default: false })
  is_written_off: boolean;

  @Column({ 
    name: 'checked_at', 
    type: 'timestamptz', 
    default: () => 'CURRENT_TIMESTAMP' 
  })
  checked_at: Date;

  @ManyToOne(() => Place, { nullable: true })
  @JoinColumn({ name: 'place' })
  placeEntity: Place | null;  
}