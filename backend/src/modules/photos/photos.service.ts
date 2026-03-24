import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Express } from 'express';
import { Photo } from './entities/photos.entity';
import sharp from 'sharp';

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Photo)
    private photosRepository: Repository<Photo>,
  ) {}

  // Настройки размеров
  private readonly THUMBNAIL_SIZE = 150; // квадрат 150x150
  private readonly MAX_SIZE = 800; // полный размер

  async create(objectId: number, file: Express.Multer.File, userId: number): Promise<Photo> {
    try {
      // 1. Обрабатываем оригинал: ресайз до квадрата (cover crop)
      const processedMaxBuffer = await sharp(file.buffer)
        .rotate() // автоматический поворот по EXIF
        .resize(this.MAX_SIZE, this.MAX_SIZE, {
          fit: 'cover', // обрезаем до квадрата
          position: 'center' // центр - приоритет
        })
        .jpeg({ quality: 85 }) // сжимаем
        .toBuffer();

      // 2. Создаем миниатюру 150x150
      const processedMinBuffer = await sharp(processedMaxBuffer)
        .resize(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 75 }) // миниатюру можно сильнее сжать
        .toBuffer();

      // 3. Сохраняем в БД
      const photo = this.photosRepository.create({
        object_id: objectId,
        photo_max_data: processedMaxBuffer,
        photo_min_data: processedMinBuffer,
        created_by: userId,
      });

      return await this.photosRepository.save(photo);
      
    } catch (error) {
      throw new BadRequestException('Failed to process image: ' + error.message);
    }
  }

  async findAllByObject(objectId: number): Promise<Photo[]> {
    return this.photosRepository.find({
      where: { object_id: objectId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Photo> {
    const photo = await this.photosRepository.findOneBy({ id });
    
    if (!photo) {
      throw new NotFoundException(`Photo with ID ${id} not found`);
    }
    
    return photo;
  }

  async remove(id: number): Promise<void> {
    const result = await this.photosRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Photo with ID ${id} not found`);
    }
  }
}