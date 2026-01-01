import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';
import { User } from '../../users/entities/user.entity';

@Entity('offline_object_changes')
export class ObjectOfflineChange {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => InventoryObject, { nullable: false })
  @JoinColumn({ name: 'object_id' })
  object: InventoryObject;

  @Column({ type: 'bigint', nullable: false })
  object_id: number;

  @Column({ type: 'text', nullable: false })
  story_line: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'changed_by' })
  changed_by_user: User;

  @Column({ type: 'bigint', nullable: false })
  changed_by: number; // user.id

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    precision: 3 // миллисекунды для точного сравнения
  })
  changed_at: Date;
}