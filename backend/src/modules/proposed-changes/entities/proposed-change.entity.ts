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

  @Column({ name: 'change_type', type: 'varchar', length: 10 })
  changeType!: string;

  @Column({ name: 'proposed_data', type: 'jsonb', nullable: true })
  proposedData!: Record<string, any> | null;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @Column({ name: 'user_abr', type: 'varchar', length: 3 })
  userAbr!: string;

  @Column({ name: 'object_buh_name', type: 'varchar', length: 255 })
  objectBuhName!: string;

  @Column({ name: 'object_inv_number', type: 'varchar', length: 255 })
  objectInvNumber!: string;

  @Column({ name: 'object_sn', type: 'varchar', length: 100, nullable: true })
  objectSn!: string | null;

  @Column({ name: 'photo_id', type: 'bigint', nullable: true })
  photoId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => InventoryObject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'object_id' })
  object!: InventoryObject;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}