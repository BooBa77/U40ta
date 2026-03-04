import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
//import { Multer } from 'multer';
import type { Response } from 'express';
import { PhotosService } from './photos.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  // Загрузка одного фото
  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Query('objectId', ParseIntPipe) objectId: number, // Используем Query, а не Param
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    
    const photo = await this.photosService.create(objectId, file);
    return {
      message: 'Photo uploaded successfully',
      photoId: photo.id,
    };
  }

  // Получить все фото объекта
  @Get('object/:objectId')
  async findByObject(@Param('objectId', ParseIntPipe) objectId: number) {
    const photos = await this.photosService.findAllByObject(objectId);
    return photos.map(photo => ({
      id: photo.id,
      object_id: photo.object_id,
      created_at: photo.created_at,
    }));
  }

  // Получить миниатюру
  @Get(':id/thumbnail')
  async getThumbnail(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const photo = await this.photosService.findOne(id);
    
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': photo.photo_min_data.length,
      'Cache-Control': 'public, max-age=86400',
    });
    
    res.send(photo.photo_min_data);
  }

  // Удалить фото
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.photosService.remove(id);
  }
  // Получить конкретное фото (полный размер)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const photo = await this.photosService.findOne(id);
    
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': photo.photo_max_data.length,
    });
    
    res.send(photo.photo_max_data);
  }
}