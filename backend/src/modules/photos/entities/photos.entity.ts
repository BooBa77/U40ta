import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('photos')
@Index('idx_photos_object_id', ['objectId'])
export class Photo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'photo_max_data', type: 'bytea', nullable: false })
  photoMaxData!: Buffer; // для бинарных данных используем Buffer

  @Column({ name: 'photo_min_data', type: 'bytea', nullable: false })
  photoMinData!: Buffer;

  @Column({ name: 'object_id', type: 'bigint', nullable: false })
  objectId!: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number;

  @Column({ name: 'created_at', type: 'timestamp with time zone', default: () => 'now()', nullable: false })
  createdAt!: Date;
}