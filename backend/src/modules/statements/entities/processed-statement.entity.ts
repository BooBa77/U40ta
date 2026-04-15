import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';

@Entity('processed_statements')
export class ProcessedStatement {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EmailAttachment)
  @JoinColumn({ name: 'email_attachment_id' })
  emailAttachment!: EmailAttachment;

  @Column({ name: 'email_attachment_id' })
  emailAttachmentId!: number;

  @Column({ name: "zavod", type: 'integer' })
  zavod!: number; // например 4030

  @Column({ name: "sklad", type: 'varchar', length: 8 })
  sklad!: string; // Код склада (например "s010")

  @Column({ name: 'doc_type', type: 'varchar', length: 10 })
  docType!: string; // "ОСВ", "ОС"

  @Column({ name: 'inv_number', type: 'varchar', length: 255 })
  invNumber!: string; // инвентарный номер

  @Column({ name: 'party_number', type: 'varchar', length: 255 })
  partyNumber!: string; // номер партии

  @Column({ name: 'buh_name', type: 'text' })
  buhName!: string; // бухгалтерское наименование

  @Column({ name: 'have_object', type: 'boolean', default: false })
  haveObject!: boolean; // есть ли объект в системе

  @Column({ name: 'is_ignore', type: 'boolean', default: false })
  isIgnore!: boolean; // игнорировать ли эту строку

  @Column({ name: 'is_excess', type: 'boolean', default: false })
  isExcess!: boolean; // дополнительная запись, не входящая в ведомость. 
  // Это объект уже не числится на складе. Завели, чтобы подсветить проблему - объект требуется переместить 
}