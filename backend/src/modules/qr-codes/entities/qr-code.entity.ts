import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('qr_codes')
@Index('qr_codes_qr_value_key', ['qr_value'], { unique: true })
export class QrCode {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'qr_value',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  qr_value: string;

  @Column({
    name: 'object_id',
    type: 'bigint',
    nullable: false,
  })
  object_id: number;
}