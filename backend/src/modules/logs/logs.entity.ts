import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  source!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  @Index()
  time!: Date;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  @Index()
  userId!: number | null;

  @Column({ type: 'jsonb' })
  content?: any;
}