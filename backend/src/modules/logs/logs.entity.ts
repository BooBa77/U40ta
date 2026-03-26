import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  source: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  @Index()
  time: Date;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  user_id: number | null;

  @Column({ type: 'jsonb' })
  content: any;
}