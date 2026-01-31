import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ObjectsService } from './services/objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

@Controller('objects')
@UseGuards(JwtAuthGuard) // Защита JWT для всех endpoint'ов
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.objectsService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateObjectDto: UpdateObjectDto) {
    return this.objectsService.update(+id, updateObjectDto);
  }

  /**
   * Создание нового объекта учёта
   * POST /api/objects
   */
  @Post()
  async create(@Body() createObjectDto: CreateObjectDto) {
    try {
      console.log('ObjectsController.create: получен DTO', createObjectDto);
      const newObject = await this.objectsService.create(createObjectDto);
      console.log('ObjectsController.create: создан объект', newObject);
      
      return {
        success: true,
        object: newObject,
        message: 'Объект успешно создан'
      };
    } catch (error) {
      console.error('ObjectsController.create: ошибка', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}