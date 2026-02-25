import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ObjectsService } from './services/objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

@Controller('objects')
@UseGuards(JwtAuthGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  /**
   * Поиск объектов по инвкентарному номеру на конкретном складе
   * GET /api/objects/by-inv?inv=...&&zavod=...&sklad=...
   */
  @Get('by-inv')
  async findByInvParty(
    @Query('inv') inv: string,
    @Query('zavod') zavod?: string,
    @Query('sklad') sklad?: string
  ) {
    try {
      console.log(`[ObjectsController] Запрос объектов по inv=${inv}, zavod=${zavod}, sklad=${sklad}`);
      
      if (!inv || inv.trim() === '') {
        return {
          success: false,
          error: 'Инвентарный номер обязателен',
          objects: []
        };
      }
      
      const zavodValue = zavod ? parseInt(zavod, 10) : undefined;
      const skladValue = sklad || undefined;
      
      const objects = await this.objectsService.findByInv(
        inv.trim(), 
        zavodValue,
        skladValue
      );
      
      return {
        success: true,
        objects,
        count: objects.length
      };
    } catch (error) {
      console.error('[ObjectsController] Ошибка поиска объектов:', error);
      return {
        success: false,
        error: error.message,
        objects: []
      };
    }
  }

  /**
   * Получение объекта по ID
   * GET /api/objects/:id
   */
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