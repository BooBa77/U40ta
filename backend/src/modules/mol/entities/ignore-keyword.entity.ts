import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Сущность игнор-слов МОЛа.
 * 
 * При загрузке ведомости строки, в которых buh_name содержит
 * одно из ключевых слов МОЛа, автоматически помечаются isActual = false.
 * 
 * Поиск ведётся по целому слову (не частичное вхождение), регистронезависимо.
 */
@Entity('ignore_keywords')
export class IgnoreKeyword {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    /** ID пользователя (МОЛа), которому принадлежит правило */
    @Column({ name: 'user_id', type: 'bigint' })
    userId!: number;

    /** Ключевое слово для поиска в buh_name */
    @Column({ name: 'keyword', type: 'text' })
    keyword!: string;

    /** Связь с пользователем */
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;
}