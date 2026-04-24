import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ObjectsService } from './services/objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

// Интерфейс для типизации пользователя в запросе
interface RequestWithUser extends ExpressRequest {
  user?: {
    sub: number;
  };
}

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

  /**
   * Создание нового объекта со связанными данными
   * POST /api/objects
   * 
   * Принимает полный пакет данных из формы редактирования:
   * - Поля самого объекта
   * - qrCodes: массив значений QR для привязки
   * - photosToAdd: массив фото в base64 (max и min)
   * 
   * Все операции выполняются в одной транзакции.
   */
  @Post()
  async create(
    @Body() createObjectDto: CreateObjectDto,
    @Req() request: RequestWithUser, // получаем request с пользователем
  ){
    try {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedException('Пользователь не авторизован');
      }      
      const newObject = await this.objectsService.create(createObjectDto, userId);
      return {
        success: true,
        object: newObject,
        message: 'Объект успешно создан'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновление существующего объекта со связанными данными
   * PATCH /api/objects/:id
   * 
   * Принимает частичный пакет данных — только те поля, которые изменились:
   * - Поля объекта (sn, местоположение)
   * - qrCodes: новый полный набор QR (сервер сам определит что добавить/удалить)
   * - photosToDelete: массив ID фото на удаление
   * - photosToAdd: массив новых фото в base64
   * - checked_at: дата проверки
   * 
   * Все операции выполняются в одной транзакции.
   */  
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateObjectDto: UpdateObjectDto,
    @Req() request: RequestWithUser, // получаем request с пользователем    
  ) {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedException('Пользователь не авторизован');
      }            
      const updatedObject = await this.objectsService.update(+id, updateObjectDto, userId);
      return {
        success: true,
        object: updatedObject,
        message: 'Объект успешно обновлён'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}