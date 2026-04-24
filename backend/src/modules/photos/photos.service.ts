// photos.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Photo } from './entities/photos.entity';

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Photo)
    private readonly photosRepository: Repository<Photo>,
  ) {}

  /**
   * Находит одно фото по ID
   * @param id - ID фото
   * @param manager - Опциональный менеджер транзакции
   */
  async findOne(id: number, manager?: EntityManager): Promise<Photo> {
    const repo = manager ? manager.getRepository(Photo) : this.photosRepository;
    
    const photo = await repo.findOne({ where: { id } });
    if (!photo) {
      throw new NotFoundException(`Photo with ID ${id} not found`);
    }
    return photo;
  }

  /**
   * Получает все фото объекта
   * @param objectId - ID объекта
   * @param manager - Опциональный менеджер транзакции
   */
  async findAllByObject(objectId: number, manager?: EntityManager): Promise<Photo[]> {
    const repo = manager ? manager.getRepository(Photo) : this.photosRepository;
    
    return repo.find({
      where: { objectId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Создаёт фото из готовых Buffer'ов (уже обработанных на фронте), для массовой выгрузке
   * @param objectId - ID объекта
   * @param maxBuffer - Buffer полноразмерного фото
   * @param minBuffer - Buffer миниатюры
   * @param userId - ID пользователя создавшего фото
   * @param manager - Опциональный менеджер транзакции
   */
  async createFromBuffers(
    objectId: number,
    maxBuffer: Buffer,
    minBuffer: Buffer,
    userId: number,
    manager?: EntityManager,
  ): Promise<Photo> {
    const repo = manager ? manager.getRepository(Photo) : this.photosRepository;

    const photo = repo.create({
      objectId,
      photoMaxData: maxBuffer,
      photoMinData: minBuffer,
      createdBy: userId,
    });

    return repo.save(photo);
  }

  /**
   * Создаёт фото из Multer файла (для выгрузки отдельной фотографии)
   * @param objectId - ID объекта
   * @param file - Файл загруженный через Multer
   * @param userId - ID пользователя
   * @param manager - Опциональный менеджер транзакции для поддержки транзакционности на уровне сервиса
   */
  async createFromFile(
    objectId: number,
    file: Express.Multer.File,
    userId: number,
    manager?: EntityManager,
  ): Promise<Photo> {
    // Принимаем файл как есть, без обработки
    // Предполагаем что фронт уже прислал оптимизированное изображение
    return this.createFromBuffers(objectId, file.buffer, file.buffer, userId, manager);
  }

  /**
   * Удаляет фото по ID
   * @param id - ID фото
   * @param manager - Опциональный менеджер транзакции для поддержки транзакционности на уровне сервиса
   */
  async remove(id: number, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Photo) : this.photosRepository;

    const result = await repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Photo with ID ${id} not found`);
    }
  }
}