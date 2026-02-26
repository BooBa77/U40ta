// qr-codes-changes.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { QrCode } from '../../qr-codes/entities/qr-code.entity';

@Entity('qr_codes_changes')
export class QrCodesChange {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'qr_code_id',
    type: 'bigint',
    nullable: false,
  })
  qr_code_id: number;

  @Column({
    name: 'old_object_id',
    type: 'bigint',
    nullable: false,
  })
  old_object_id: number;

  @Column({
    name: 'new_object_id',
    type: 'bigint',
    nullable: false,
  })
  new_object_id: number;

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

  // Связь с таблицей qr_codes
  @ManyToOne(() => QrCode, (qrCode) => qrCode.changes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'qr_code_id' })
  qrCode: QrCode;
}