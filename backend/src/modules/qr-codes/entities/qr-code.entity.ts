import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('qr_codes')
@Index('idx_qr_codes_object_id', ['object_id'])
@Index('idx_qr_codes_qr_value', ['qr_value'])
export class QrCode {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'qr_value',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  qr_value: string;

  @Column({
    name: 'object_id',
    type: 'bigint',
    nullable: false,
  })
  object_id: number;
}