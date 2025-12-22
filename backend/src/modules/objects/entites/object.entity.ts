import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Place } from '../../places/entites/place.entity';

@Entity('objects')
@Index('idx_objects_composite', ['zavod', 'sklad', 'inv_number', 'party_number'])
@Index('idx_objects_sklad', ['zavod', 'sklad'])
@Index('idx_objects_place', ['place'])
export class InventoryObject {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer', nullable: false })
  zavod: number;

  @Column({ type: 'varchar', length: 4, nullable: false })
  sklad: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  buh_name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  inv_number: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  party_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sn: string | null;

  @Column({ type: 'bigint', nullable: true })
  place: number | null;

  @Column({ type: 'text', nullable: true })
  commentary: string | null;

  // Если есть Place entity
  @ManyToOne(() => Place, { nullable: true })
  @JoinColumn({ name: 'place' })
  placeRelation?: Place;
}