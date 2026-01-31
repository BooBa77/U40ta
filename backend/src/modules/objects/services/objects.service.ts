import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryObject } from '../entities/object.entity';
import { CreateObjectDto } from '../dto/create-object.dto';
import { UpdateObjectDto } from '../dto/update-object.dto';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(InventoryObject)
    private readonly objectRepository: Repository<InventoryObject>, // ← один репозиторий
  ) {}

  async findOne(id: number): Promise<InventoryObject> {
    const object = await this.objectRepository.findOne({ where: { id } });
    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }
    return object;
  }

  // Создание объекта через репозиторий
  async create(createObjectDto: CreateObjectDto): Promise<InventoryObject> {
    const object = this.objectRepository.create({
      ...createObjectDto,
      is_written_off: false,
      checked_at: new Date(),
    });

    return await this.objectRepository.save(object);
  }
  
  // Редактирование объекта
  async update(id: number, updateObjectDto: UpdateObjectDto): Promise<InventoryObject> {
    const object = await this.findOne(id);
    Object.assign(object, updateObjectDto);
    return this.objectRepository.save(object);
  }
}