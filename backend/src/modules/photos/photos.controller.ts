// photos.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { PhotosService } from './photos.service';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /**
   * Загрузка одного фото (используется при синхронизации офлайн-данных)
   */
  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Query('objectId', ParseIntPipe) objectId: number,
    @Req() request: RequestWithUser,
  ) {
    if (!file) {
      throw new Error('Файл обязателен');
    }

    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }

    const photo = await this.photosService.createFromFile(objectId, file, userId);

    return {
      message: 'Фото успешно загружено',
      photoId: photo.id,
    };
  }

  /**
   * Получить все фото объекта
   */
  @Get('object/:objectId')
  async findByObject(@Param('objectId', ParseIntPipe) objectId: number) {
    const photos = await this.photosService.findAllByObject(objectId);
    return photos.map((photo) => ({
      id: photo.id,
      objectId: photo.objectId,
      url: `/api/photos/${photo.id}`,
      thumbUrl: `/api/photos/${photo.id}/thumbnail`,
    }));
  }

  /**
   * Получить полноразмерное фото
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const photo = await this.photosService.findOne(id);

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': photo.photoMaxData.length,
    });

    res.send(photo.photoMaxData);
  }

  /**
   * Получить миниатюру фото
   */
  @Get(':id/thumbnail')
  async getThumbnail(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const photo = await this.photosService.findOne(id);

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': photo.photoMinData.length,
    });

    res.send(photo.photoMinData);
  }

  /**
   * Удалить фото
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.photosService.remove(id);
  }
}