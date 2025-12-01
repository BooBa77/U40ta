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

  @Column('boolean', { nullable: true })
  good_file: boolean | null; // применим ли файл для работы

  @Column('text', { nullable: true })
  doc_type: string | null; // 'ОСВ' или 'Инвентаризация'

  @Column('text', { nullable: true })
  sklad: string | null; // код склада

  @Column('text', { nullable: true })
  error_reason: string | null; // описание ошибки применения файла
}