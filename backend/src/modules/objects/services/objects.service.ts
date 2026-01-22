import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../entities/object.entity';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(InventoryObject)
    private objectsRepository: Repository<InventoryObject>,
  ) {}

  async findAll(): Promise<InventoryObject[]> {
    return this.objectsRepository.find({
      relations: ['placeEntity'], // загрузить связанное место
    });
  }
}