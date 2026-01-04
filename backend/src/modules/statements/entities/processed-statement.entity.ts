import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';

@Entity('processed_statements')
export class ProcessedStatement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EmailAttachment)
  @JoinColumn({ name: 'email_attachment_id' })
  emailAttachment: EmailAttachment;

  @Column({ name: 'email_attachment_id' })
  emailAttachmentId: number;

  @Column({ type: 'integer' })
  zavod: number; // например 4030

  @Column({ type: 'varchar', length: 4 })
  sklad: string; // Код склада (например "s010")

  @Column({ type: 'varchar', length: 10 })
  doc_type: string; // "ОСВ", "ОС"

  @Column({ type: 'varchar', length: 255 })
  inv_number: string; // инвентарный номер

  @Column({ type: 'varchar', length: 255 })
  party_number: string; // номер партии

  @Column({ type: 'text' })
  buh_name: string; // бухгалтерское наименование

  @Column({ type: 'boolean', default: false })
  have_object: boolean; // есть ли объект в системе

  @Column({ type: 'boolean', default: false })
  is_ignore: boolean; // игнорировать ли эту строку

  @Column({ type: 'boolean', default: false })
  is_excess: boolean; // дополнительная запись, не входящая в ведомость. 
  // Это объект уже не числится на складе. Завели, чтобы подсветить проблему - объект требуется переместить 
}