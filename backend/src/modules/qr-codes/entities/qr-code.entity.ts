import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { InventoryObject } from '../../objects/entities/object.entity';

@Entity('qr_codes')
@Unique('qr_codes_qr_value_key', ['qrValue'])
export class QrCode {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'qr_value', type: 'varchar', length: 255, nullable: false })
  qrValue!: string;

  @ManyToOne(() => InventoryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id', foreignKeyConstraintName: 'qr_codes_object_id_fkey' })
  object!: InventoryObject | null;

  @Column({ name: 'object_id', type: 'bigint', nullable: true })
  objectId!: number | null;
}