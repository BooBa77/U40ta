import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';

@Entity('email_attachments')
export class EmailAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  filename: string;

  @Column('text', { nullable: true })
  email_from: string | null;

  @CreateDateColumn()
  received_at: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  doc_type: string | null;

  @Column({ type: 'integer', nullable: true })
  zavod: number;

  @Column({ type: 'varchar', length: 4, nullable: true })
  sklad: string | null;

  @Column({ type: 'boolean', default: false })
  in_process: boolean;

  @Column({ type: 'boolean', default: false })
  is_inventory: boolean;

  @OneToMany(() => ProcessedStatement, (statement) => statement.emailAttachment)
  processedStatements: ProcessedStatement[];
}