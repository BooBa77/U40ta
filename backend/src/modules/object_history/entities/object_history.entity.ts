import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('object_history')
@Index('object_history_object_id_fkey', ['object_id']) // для внешнего ключа
export class ObjectHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'object_id',
    type: 'bigint',
    nullable: false,
  })
  object_id: number;

  @Column({
    name: 'story_line',
    type: 'text',
    nullable: true,
  })
  story_line: string;

  @Column({
    name: 'changed_by',
    type: 'bigint',
    nullable: false,
  })
  changed_by: number;

  @Column({
    name: 'changed_at',
    type: 'timestamp', // без time zone, как в SQL
    default: () => 'CURRENT_TIMESTAMP',
  })
  changed_at: Date;
}