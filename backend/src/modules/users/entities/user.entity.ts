import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';


@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'e_mail', nullable: true, length: 255, type: 'varchar' })
  eMail!: string | null;

  @Column()
  abr!: string;

}