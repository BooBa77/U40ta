import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectChange } from './entities/object-change.entity';

@Injectable()
export class ObjectChangesService {
  constructor(
    @InjectRepository(ObjectChange)
    private objectChangesRepository: Repository<ObjectChange>,
  ) {}

  async logChange(data: {
    object_id: number;
    changed_by: number;
    story_line: string;
  }): Promise<ObjectChange> {
    const change = this.objectChangesRepository.create(data);
    return this.objectChangesRepository.save(change);
  }

  async getObjectHistory(objectId: number): Promise<ObjectChange[]> {
    return this.objectChangesRepository.find({
      where: { object_id: objectId },
      order: { changed_at: 'DESC' },
    });
  }
}