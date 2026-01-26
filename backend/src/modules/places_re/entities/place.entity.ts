import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ 
    name: 'ter', 
    type: 'varchar', 
    length: 100,
    nullable: true 
  })
  ter: string;

  @Column({ 
    name: 'pos', 
    type: 'varchar', 
    length: 100,
    nullable: true 
  })
  pos: string;

  @Column({ 
    name: 'cab', 
    type: 'varchar', 
    length: 100,
    nullable: true 
  })
  cab: string;

  @Column({ 
    name: 'user', 
    type: 'varchar', 
    length: 255,
    nullable: true 
  })
  user: string;
}