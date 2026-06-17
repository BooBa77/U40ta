import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';
import { User } from '../../users/entities/user.entity';

@Entity('proposed_changes')
export class ProposedChange {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'object_id', type: 'bigint' })
  objectId!: number;

  @Column({ name: 'change_type', type: 'varchar', length: 50 })
  changeType!: string;

  @Column({ name: 'proposed_data', type: 'jsonb', nullable: true })
  proposedData!: Record<string, any> | null;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => InventoryObject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'object_id' })
  object!: InventoryObject;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}