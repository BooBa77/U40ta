import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ObjectsService } from './services/objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';
import { validate } from 'class-validator';

@Controller('objects')
@UseGuards(JwtAuthGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}


  @Post()
  async create(@Body() createObjectDto: CreateObjectDto) {
    try {
      console.log('=== CREATE OBJECT ===');
      console.log('Received DTO:', JSON.stringify(createObjectDto, null, 2));
      
      // Проверяем каждое поле
      console.log('zavod:', createObjectDto.zavod, 'type:', typeof createObjectDto.zavod);
      console.log('sklad:', createObjectDto.sklad, 'type:', typeof createObjectDto.sklad);
      console.log('buh_name:', createObjectDto.buh_name);
      console.log('inv_number:', createObjectDto.inv_number);
      console.log('party_number:', createObjectDto.party_number);
      console.log('sn:', createObjectDto.sn);
      
      // Вручную проверяем валидацию
      const errors = await validate(createObjectDto);
      if (errors.length > 0) {
        console.error('Validation errors:', JSON.stringify(errors, null, 2));
        return {
          statusCode: 400,
          message: 'Validation failed',
          errors: errors.map(err => ({
            property: err.property,
            constraints: err.constraints
          }))
        };
      }
      
      const newObject = await this.objectsService.create(createObjectDto);
      console.log('Object created:', newObject);
      
      return {
        success: true,
        object: newObject,
        message: 'Объект успешно создан'
      };
    } catch (error) {
      console.error('ERROR in create:', error);
      console.error('Error stack:', error.stack);
      
      // Логируем детали ошибки TypeORM
      if (error.code) {
        console.error('PostgreSQL error code:', error.code);
        console.error('PostgreSQL detail:', error.detail);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }









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
   * Получение всех уникальных комбинаций местоположений
   * GET /api/objects/place-combinations
   */
  @Get('place-combinations')
  async getPlaceCombinations() {
    try {
      const combinations = await this.objectsService.getPlaceCombinations();
      return {
        success: true,
        combinations
      };
    } catch (error) {
      console.error('[ObjectsController] Ошибка получения комбинаций:', error);
      return {
        success: false,
        error: error.message,
        combinations: []
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
  async create_(@Body() createObjectDto: CreateObjectDto) {
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