import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('logs')
@Index('idx_logs_source', ['source'])
@Index('idx_logs_time', ['time'])
@Index('idx_logs_user_id', ['userId'])
// GIN-индекс по jsonb. TypeORM 0.3 не умеет объявлять GIN через @Index,
// поэтому индекс помечен synchronize: false: он уже есть в боевой базе,
// и TypeORM не должен его ни удалять, ни пересоздавать.
@Index('idx_logs_content', { synchronize: false })
export class Log {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  source!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  time!: Date;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId!: number | null;

  @Column({ type: 'jsonb' })
  content!: any;
}