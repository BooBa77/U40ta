import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_attachments')
export class EmailAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string; // имя файла

  @Column({ nullable: true })
  email_from: string; // от кого пришло

  @CreateDateColumn()
  received_at: Date; // дата загрузки

  @Column({ nullable: true })
  good_file: boolean; // применим ли файл для работы

  @Column({ nullable: true })
  type: string; // 'ОСВ' или 'Инвентаризация'

  @Column({ nullable: true })
  sklad: string; // код склада

  @Column({ nullable: true })
  error_reason: string; // описание ошибки применения файла
}