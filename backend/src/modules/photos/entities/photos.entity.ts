import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('photos')
@Index('idx_photos_object_id', ['object_id'])
export class Photo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'photo_max_data',
    type: 'bytea',
    nullable: false,
  })
  photo_max_data: Buffer; // для бинарных данных используем Buffer

  @Column({
    name: 'photo_min_data',
    type: 'bytea',
    nullable: false,
  })
  photo_min_data: Buffer;

  @Column({
    name: 'object_id',
    type: 'bigint',
    nullable: false,
  })
  object_id: number;

  @Column({
    name: 'created_by',
    type: 'bigint',
    nullable: true,
  })
  created_by: number;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'now()',
    nullable: false,
  })
  created_at: Date;
}