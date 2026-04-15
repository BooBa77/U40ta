import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';

@Entity('qr_codes')
export class QrCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'qr_value', type: 'text', unique: true, nullable: false })
  qrValue!: string;

  @ManyToOne(() => InventoryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: InventoryObject | null;

  @Column({ name: 'object_id', type: 'integer', nullable: true })
  objectId!: number | null;
}