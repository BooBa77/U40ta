import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectHistory } from './entities/object_history.entity';

@Injectable()
export class ObjectHistoryService {
  constructor(
    @InjectRepository(ObjectHistory)
    private objectHistoryRepository: Repository<ObjectHistory>,
  ) {}

  async logHistory(data: {
    object_id: number;
    changed_by: number;
    story_line: string;
  }): Promise<ObjectHistory> {
    const story = this.objectHistoryRepository.create(data);
    return this.objectHistoryRepository.save(story);
  }

  async getObjectHistory(objectId: number): Promise<ObjectHistory[]> {
    return this.objectHistoryRepository.find({
      where: { object_id: objectId },
      order: { changed_at: 'DESC' },
    });
  }
}