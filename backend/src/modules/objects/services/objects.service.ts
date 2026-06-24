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
    sklad?: string,
    partyNumber?: string
  ): Promise<InventoryObject[]> {
    console.log(`[ObjectsService] Поиск объектов: inv=${invNumber}, zavod=${zavod}, sklad=${sklad}, party=${partyNumber}`);
    
    const queryBuilder = this.objectRepository
      .createQueryBuilder('object')
      .where('object.inv_number = :invNumber', { invNumber });
    
    if (zavod !== undefined && !isNaN(zavod)) {
      queryBuilder.andWhere('object.zavod = :zavod', { zavod });
    }
    
    if (sklad && sklad.trim() !== '') {
      queryBuilder.andWhere('object.sklad = :sklad', { sklad });
    }

    if (partyNumber && partyNumber.trim() !== '') {
      queryBuilder.andWhere('object.party_number = :partyNumber', { partyNumber });
    }
    
    const objects = await queryBuilder.getMany();
    
    console.log(`[ObjectsService] Найдено объектов: ${objects.length}`);
    return objects;
  }

  /**
   * Находит все объекты по заводу и складу
   * @param zavod - номер завода
   * @param sklad - код склада
   * @returns Массив объектов
   */
  async findBySklad(zavod: number, sklad: string): Promise<InventoryObject[]> {
    return await this.objectRepository.find({
      where: {
        zavod: zavod,
        sklad: sklad
      },
      order: {
        invNumber: 'ASC'
      }
    })
  }

  /**
   * Находит все объекты с заданным местоположением.
   * Пустые значения в полях места сравниваются с NULL в БД.
   * 
   * @param placeTer — территория
   * @param placePos — здание (null если отсутствует)
   * @param placeCab — кабинет (null если отсутствует)
   * @param placeUser — пользователь (null если отсутствует)
   * @param excludeId — ID объекта для исключения из выборки
   * @returns Массив объектов
   */
  async findByPlaces(
    placeTer: string | null,
    placePos: string | null,
    placeCab: string | null,
    placeUser: string | null,
    excludeId: number | null,
  ): Promise<InventoryObject[]> {
    const qb = this.objectRepository.createQueryBuilder('obj');
    
    if (placeTer) {
      qb.where('obj.placeTer = :placeTer', { placeTer });
    }

    if (placePos) {
      qb.andWhere('obj.placePos = :placePos', { placePos });
    } else {
      qb.andWhere('obj.placePos IS NULL');
    }

    if (placeCab) {
      qb.andWhere('obj.placeCab = :placeCab', { placeCab });
    } else {
      qb.andWhere('obj.placeCab IS NULL');
    }

    if (placeUser) {
      qb.andWhere('obj.placeUser = :placeUser', { placeUser });
    } else {
      qb.andWhere('obj.placeUser IS NULL');
    }

    if (excludeId != null) {
      qb.andWhere('obj.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  /**
   * Получение уникальных комбинаций zavod + sklad из таблицы objects.
   * Возвращает массив { zavod, sklad }, отсортированный по zavod, sklad.
   */
  async getSkladCombinations(): Promise<{ zavod: number; sklad: string }[]> {
    const result = await this.objectRepository
      .createQueryBuilder('object')
      .select('object.zavod', 'zavod')
      .addSelect('object.sklad', 'sklad')
      .where('object.sklad IS NOT NULL')
      .andWhere('object.sklad != :empty', { empty: '' })
      .distinct(true)
      .orderBy('object.zavod')
      .addOrderBy('object.sklad')
      .getRawMany();

    return result.map(r => ({
      zavod: Number(r.zavod),
      sklad: r.sklad
    }));
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
   * Создание объекта со всеми связанными данными (qr-коды, фотографии) в одной транзакции.
   * При синхронизации на выход из оффлайн выполняется в общей транзакции, которая передаётся внешним менеджером manager?
   */
  async create(dto: CreateObjectDto, userId: number, manager?: EntityManager): Promise<InventoryObject> {
    const run = async (mgr: EntityManager) => {
      // 1. Создаём объект
      const object = mgr.create(InventoryObject, {
        ...dto,
        isWrittenOff: false,
        checkedAt: new Date(),
      });

      const savedObject = await mgr.save(object);

      // 2. Привязываем QR-коды
      if (dto.qrCodes?.length) {
        for (const qrValue of dto.qrCodes) {
          await this.qrCodesService.save(qrValue, savedObject.id, mgr);
        }
      }

      // 3. Сохраняем фото
      if (dto.photosToAdd?.length) {
        for (const photoDto of dto.photosToAdd) {
          const maxBuffer = Buffer.from(photoDto.max, 'base64');
          const minBuffer = Buffer.from(photoDto.min, 'base64');
          await this.photosService.createFromBuffers(savedObject.id, maxBuffer, minBuffer, userId, mgr);
        }
      }

      return savedObject;
    };

    return manager ? run(manager) : this.entityManager.transaction(run); // Если сейчас онлайн режим и внешний менеджер (транзакция) не передан, то создаём свою транзакцию и работаем в ней
  }

  /**
   * Обновление объекта со всеми связанными данными (qr-коды, фотографии) в одной транзакции.
   * При синхронизации на выход из оффлайн выполняется в общей транзакции, которая передаётся внешним менеджером manager.
   */
  
  async update(id: number, dto: UpdateObjectDto, userId: number, manager?: EntityManager): Promise<InventoryObject> {
    const run = async (mgr: EntityManager) => {
      // 1. Находим объект
      const object = await mgr.findOne(InventoryObject, { where: { id } });
      if (!object) {
        throw new NotFoundException(`Object with ID ${id} not found`);
      }

      // 2. Если меняется склад — сбрасываем местоположение
      if (dto.zavod !== undefined || dto.sklad !== undefined) {
        const newZavod = dto.zavod ?? object.zavod;
        const newSklad = dto.sklad ?? object.sklad;
        
        if (newZavod !== object.zavod || newSklad !== object.sklad) {
          object.placeTer = null;
          object.placePos = null;
          object.placeCab = null;
          object.placeUser = null;
        }
      }

      // 3. Обновляем поля, переданные через DTO
      Object.assign(object, dto);

      if (dto.checkedAt) {
        object.checkedAt = new Date(dto.checkedAt);
      }

      const savedObject = await mgr.save(object);

      // 4. Обрабатываем QR-коды (полная замена набора)
      if (dto.qrCodes?.length) {
        for (const qrValue of dto.qrCodes) {
          await this.qrCodesService.save(qrValue, savedObject.id, mgr);
        }
      }

      // 5. Удаляем помеченные фото
      if (dto.photosToDelete?.length) {
        for (const photoId of dto.photosToDelete) {
          await this.photosService.remove(photoId, mgr);
        }
      }

      // 6. Добавляем новые фото
      if (dto.photosToAdd?.length) {
        for (const photoDto of dto.photosToAdd) {
          const maxBuffer = Buffer.from(photoDto.max, 'base64');
          const minBuffer = Buffer.from(photoDto.min, 'base64');
          await this.photosService.createFromBuffers(savedObject.id, maxBuffer, minBuffer, userId, mgr);
        }
      }

      return savedObject;
    };

    return manager ? run(manager) : this.entityManager.transaction(run);
    // Если сейчас онлайн режим и внешний менеджер (транзакция) не передан, то создаём свою транзакцию и работаем в ней
  }

  /**
   * Поиск похожих объектов при синхронизации из офлайна.
   * Если docType = 'ОС' — ищет только по invNumber.
   * Если docType = 'ОСВ' — ищет по invNumber + partyNumber + sn.
   * @param docType - тип документа ('ОС' | 'ОСВ')
   * @param invNumber - инвентарный номер
   * @param partyNumber - номер партии (только для ОСВ)
   * @param sn - серийный номер (только для ОСВ)
   */
  async findSimilar(
    docType: string,
    invNumber: string,
    partyNumber?: string,
    sn?: string,
  ): Promise<InventoryObject[]> {
    console.log(`[ObjectsService] findSimilar: docType=${docType}, inv=${invNumber}, party=${partyNumber}, sn=${sn}`);

    const queryBuilder = this.objectRepository
      .createQueryBuilder('object')
      .where('object.inv_number = :invNumber', { invNumber });

    if (docType === 'ОСВ') {
      if (partyNumber && partyNumber.trim() !== '') {
        queryBuilder.andWhere('object.party_number = :partyNumber', { partyNumber });
      }
      if (sn && sn.trim() !== '' && sn !== '-') {
        queryBuilder.andWhere('object.sn = :sn', { sn });
      }
    }
    // Для 'ОС' дополнительные условия не добавляем — только invNumber

    const objects = await queryBuilder.getMany();
    console.log(`[ObjectsService] findSimilar: найдено ${objects.length} объектов`);
    return objects;
  }
}