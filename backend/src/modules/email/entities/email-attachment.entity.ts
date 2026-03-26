import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';

@Entity('email_attachments')
export class EmailAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  filename: string;

  @Column('text', { nullable: true, name: 'email_from' })
  emailFrom: string | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'doc_type' })
  docType: string | null;

  @Column({ type: 'integer', nullable: true })
  zavod: number;

  @Column({ type: 'varchar', length: 8, nullable: false })
  sklad: string | null;

  @Column({ type: 'boolean', default: false, name: 'in_process' })
  inProcess: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_inventory' })
  isInventory: boolean;

  @OneToMany(() => ProcessedStatement, (statement) => statement.emailAttachment)
  processedStatements: ProcessedStatement[];
}