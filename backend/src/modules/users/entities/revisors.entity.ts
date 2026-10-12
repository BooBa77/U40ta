import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Сущность ревизора.
 * 
 * Определяет, какие пользователи системы имеют роль ревизора.
 * Ревизор может загружать инвентаризационные ведомости (Excel-файлы)
 * и работать с ними в интерфейсе инвентаризации.
 * 
 * Связь с таблицей users через внешний ключ user_id.
 */
@Entity('revisors')
export class Revisors {
  /**
   * ID пользователя системы (users.id).
   * Является первичным ключом — один пользователь может быть ревизором только один раз.
   */
  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /**
   * Связь с пользователем. Объявлена ради имени внешнего ключа
   * в боевой базе (`revisors_user_id_fkey`) — TypeORM иначе предложит
   * пересоздать ограничение под именем-хешем.
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'revisors_user_id_fkey' })
  user!: User;
}