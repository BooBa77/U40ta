import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ProcessedStatement } from '../../statements/entities/processed-statement.entity';

@Entity('email_attachments')
export class EmailAttachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  filename!: string;

  @Column({ name: "email_from", type: "text", nullable: true })
  emailFrom!: string | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt!: Date;

  @Column({ name: 'doc_type', type: 'varchar', length: 10, nullable: true })
  docType!: string | null;

  @Column({ name: 'zavod', type: 'integer', nullable: true })
  zavod!: number;

  @Column({ name: 'sklad', type: 'varchar', length: 8, nullable: false })
  sklad!: string | null;

  @Column({ name: 'in_process', type: 'boolean', default: false })
  inProcess!: boolean;

  @Column({ name: 'is_inventory', type: 'boolean', default: false })
  isInventory!: boolean;

  @OneToMany(() => ProcessedStatement, (statement) => statement.emailAttachment)
  processedStatements!: ProcessedStatement[];
}