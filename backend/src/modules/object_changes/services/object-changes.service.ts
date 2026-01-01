import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ObjectChange } from '../entities/object-change.entity';

@Injectable()
export class ObjectChangesService {
  constructor(
    @InjectRepository(ObjectChange)
    private objectChangesRepository: Repository<ObjectChange>,
  ) {}

  /**
   * Получить изменения за последние N дней
   * @param days Количество дней
   */
  async findRecent(days: number): Promise<ObjectChange[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    return this.objectChangesRepository.find({
      where: {
        changed_at: MoreThanOrEqual(date),
      },
      order: {
        changed_at: 'DESC',
      },
      relations: ['object'], // если нужно загрузить связанный объект
    });
  }

  /**
   * Получить все изменения
   */
  async findAll(): Promise<ObjectChange[]> {
    return this.objectChangesRepository.find({
      order: {
        changed_at: 'DESC',
      },
    });
  }

  /**
   * Создать запись об изменении
   */
  async create(
    objectId: number,
    storyLine: string,
    changedBy: number,
  ): Promise<ObjectChange> {
    const change = this.objectChangesRepository.create({
      object_id: objectId,
      story_line: storyLine,
      changed_by: changedBy,
    });
    
    return this.objectChangesRepository.save(change);
  }
}