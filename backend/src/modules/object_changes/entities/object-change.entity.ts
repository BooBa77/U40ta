import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';

@Entity('object_changes')
export class ObjectChange {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'object_id',
    type: 'bigint',
    nullable: false,
  })
  object_id: number;

  @ManyToOne(() => InventoryObject)
  @JoinColumn({ name: 'object_id' })
  object: InventoryObject;

  @Column({
    name: 'story_line',
    type: 'text',
    nullable: true,
  })
  story_line: string;

  @Column({
    name: 'changed_by',
    type: 'bigint',
    nullable: false,
  })
  changed_by: number;

  @Column({
    name: 'changed_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  changed_at: Date;
}