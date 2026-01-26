import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../entities/object.entity';
import { UpdateObjectDto } from '../dto/update-object.dto';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(InventoryObject)
    private readonly objectRepository: Repository<InventoryObject>,
  ) {}

  async findOne(id: number): Promise<InventoryObject> {
    const object = await this.objectRepository.findOne({ where: { id } });
    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }
    return object;
  }

  async update(id: number, updateObjectDto: UpdateObjectDto): Promise<InventoryObject> {
    const object = await this.findOne(id);
    Object.assign(object, updateObjectDto);
    return this.objectRepository.save(object);
  }
}