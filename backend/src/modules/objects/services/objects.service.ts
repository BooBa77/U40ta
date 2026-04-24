import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager  } from 'typeorm';
import { InventoryObject } from '../entities/object.entity';
import { CreateObjectDto } from '../dto/create-object.dto';
import { UpdateObjectDto } from '../dto/update-object.dto';
import { PhotosService } from '../../photos/photos.service';
import { QrCodesService } from '../../qr-codes/qr-codes.service';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(InventoryObject)
    private readonly objectRepository: Repository<InventoryObject>,
    private readonly entityManager: EntityManager,
    private readonly photosService: PhotosService,
    private readonly qrCodesService: QrCodesService,
  ) {}

  async findOne(id: number): Promise<InventoryObject> {
    const object = await this.objectRepository.findOne({ where: { id } });
    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }
    return object;
  }

  // Поиск объектов по инвентарному номеру в определённом складе
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
  
  /**
   * Создание объекта со всеми связанными данными (qr-коды, фотографии) в одной транзакции
   */
  async create(dto: CreateObjectDto, userId: number): Promise<InventoryObject> {
    return this.entityManager.transaction(async (manager) => {
      // 1. Создаём объект

      const object = manager.create(InventoryObject, {
        ...dto,  // ← ВСЕ ПОЛЯ СРАЗУ!
        isWrittenOff: false,
        checkedAt: new Date(),
      });

      const savedObject = await manager.save(object);

      // 2. Привязываем QR-коды
      if (dto.qrCodes?.length) {
        for (const qrValue of dto.qrCodes) {
          await this.qrCodesService.save(qrValue, savedObject.id, manager);
        }
      }

      // 3. Сохраняем фото
      if (dto.photosToAdd?.length) {
        for (const photoDto of dto.photosToAdd) {
          const maxBuffer = Buffer.from(photoDto.max, 'base64');
          const minBuffer = Buffer.from(photoDto.min, 'base64');
          await this.photosService.createFromBuffers(savedObject.id, maxBuffer, minBuffer, userId, manager);
        }
      }

      return savedObject;
    });
  }

  /**
   * Обновление объекта со всеми связанными данными (qr-коды, фотографии) в одной транзакции
   */
  async update(id: number, dto: UpdateObjectDto, userId: number): Promise<InventoryObject> {
    return this.entityManager.transaction(async (manager) => {
      // 1. Находим объект
      const object = await manager.findOne(InventoryObject, { where: { id } });
      if (!object) {
        throw new NotFoundException(`Object with ID ${id} not found`);
      }

      // 2. Обновляем поля, переданные через DTO
      Object.assign(object, dto);

      // checkedAt нужно преобразовать в Date
      if (dto.checkedAt) {
        object.checkedAt = new Date(dto.checkedAt);
      }

      const savedObject = await manager.save(object);

      // 3. Обрабатываем QR-коды (полная замена набора)
      if (dto.qrCodes?.length) {
        for (const qrValue of dto.qrCodes) {
          await this.qrCodesService.save(qrValue, savedObject.id, manager);
        }
      }      

      // 4. Удаляем помеченные фото
      if (dto.photosToDelete?.length) {
        for (const photoId of dto.photosToDelete) {
          await this.photosService.remove(photoId, manager);
        }
      }

      // 5. Добавляем новые фото
      if (dto.photosToAdd?.length) {
        for (const photoDto of dto.photosToAdd) {
          const maxBuffer = Buffer.from(photoDto.max, 'base64');
          const minBuffer = Buffer.from(photoDto.min, 'base64');
          await this.photosService.createFromBuffers(savedObject.id, maxBuffer, minBuffer, userId, manager);
        }
      }

      return savedObject;
    });
  }
}