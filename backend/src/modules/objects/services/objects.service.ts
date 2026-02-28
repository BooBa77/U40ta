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
    private readonly objectRepository: Repository<InventoryObject>,
  ) {}

  async findOne(id: number): Promise<InventoryObject> {
    const object = await this.objectRepository.findOne({ where: { id } });
    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }
    return object;
  }

  /**
   * Находит объекты по инвентарному номеру в определённом складе
   */
  async findByInv(
    invNumber: string, 
    zavod?: number,
    sklad?: string
  ): Promise<InventoryObject[]> {
    console.log(`[ObjectsService] Поиск объектов: inv=${invNumber}, zavod=${zavod}, sklad=${sklad}`);
    
    const queryBuilder = this.objectRepository
      .createQueryBuilder('object')
      .where('object.inv_number = :invNumber', { invNumber });
    
    // Фильтрация по заводу
    if (zavod !== undefined && !isNaN(zavod)) {
      queryBuilder.andWhere('object.zavod = :zavod', { zavod });
    }
    
    // Фильтрация по складу
    if (sklad && sklad.trim() !== '') {
      queryBuilder.andWhere('object.sklad = :sklad', { sklad });
    }
    
    const objects = await queryBuilder.getMany();
    
    console.log(`[ObjectsService] Найдено объектов: ${objects.length}`);
    return objects;
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

  /**
   * Получение уникальных комбинаций place_ter, place_pos, place_cab, place_user
   * Возвращает массив объектов с полями ter, pos, cab, user
   * ter - обязательно не NULL и не пустое
   * pos, cab, user могут быть NULL (их потом фильтруем на клиенте)
   */
  async getPlaceCombinations(): Promise<{ ter: string; pos: string | null; cab: string | null; user: string | null }[]> {
    console.log('[ObjectsService] Загрузка уникальных комбинаций местоположений');
    
    const result = await this.objectRepository
      .createQueryBuilder('object')
      .select('object.place_ter', 'ter')
      .addSelect('object.place_pos', 'pos')
      .addSelect('object.place_cab', 'cab')
      .addSelect('object.place_user', 'user')
      .where('object.place_ter IS NOT NULL')
      .andWhere('object.place_ter != :empty', { empty: '' })
      .distinct(true)
      .orderBy('object.place_ter')
      .addOrderBy('object.place_pos')
      .addOrderBy('object.place_cab')
      .addOrderBy('object.place_user')
      .getRawMany();
    
    console.log(`[ObjectsService] Загружено комбинаций: ${result.length}`);
    return result;
  }  
}