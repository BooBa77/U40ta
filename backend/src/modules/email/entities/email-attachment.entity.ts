import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_attachments')
export class EmailAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  filename: string; // имя файла

  @Column('text', { nullable: true })
  email_from: string | null; // от кого пришло

  @CreateDateColumn()
  received_at: Date; // дата загрузки

  @Column({ type: 'varchar', length: 10, nullable: true })
  doc_type: string | null; // 'ОСВ' или 'ОС'

  @Column({ type: 'integer', nullable: true })
  zavod: number; // например 4030

  @Column({ type: 'varchar', length: 4, nullable: true })
  sklad: string | null; // код склада

  @Column({ type: 'boolean', default: false })
  in_process: boolean; // файл в обработке

  @Column({ type: 'boolean', default: false })
  is_inventory: boolean;  
}