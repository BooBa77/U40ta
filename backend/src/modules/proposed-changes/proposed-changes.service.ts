import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { ProposedChange } from './entities/proposed-change.entity';
import { User } from '../users/entities/user.entity';
import { InventoryObject } from '../objects/entities/object.entity';
import { PhotosService } from '../photos/photos.service';
import { Photo } from '../photos/entities/photos.entity';

/**
 * Сервис для работы с предлагаемыми изменениями.
 * 
 * ## Назначение
 * - Создание предлагаемых изменений от неМОЛов
 * - Просмотр предлагаемых изменений для МОЛов
 * - Утверждение изменений (применение к объекту)
 * - Удаление записей после утверждения или отклонения
 * 
 * ## Особенности работы с фото
 * Фото в предлагаемых изменениях создаются с object_id = 0 и ждут решения МОЛа.
 * При утверждении object_id меняется на ID объекта, при отклонении фото удаляется.
 */
@Injectable()
export class ProposedChangesService {
  private readonly logger = new Logger(ProposedChangesService.name);

  constructor(
    @InjectRepository(ProposedChange)
    private readonly proposedChangesRepository: Repository<ProposedChange>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(InventoryObject)
    private readonly objectsRepository: Repository<InventoryObject>,
    private readonly photosService: PhotosService,
  ) {}

  /**
   * Создаёт пакет записей предлагаемых изменений.
   * Для каждой записи денормализует user_abr, object_buh_name, object_inv_number, object_sn.
   * Все записи создаются в одной транзакции.
   * 
   * ## Обработка фото
   * Если изменение имеет changeType 'photo' и в proposedData переданы photoMaxData/photoMinData
   * (base64), создаёт фото с object_id = 0 и записывает photoId.
   * Если передан photoId напрямую — использует его.
   * 
   * @param changes — массив изменений: { objectId, changeType, proposedData?, photoId? }
   * @param userId — ID пользователя, предложившего изменения
   * @returns Массив созданных записей ProposedChange
   */
  async createBatch(
    changes: { objectId: number; changeType: string; proposedData?: Record<string, any>; photoId?: number }[],
    userId: number
  ): Promise<ProposedChange[]> {
    this.logger.log(`Создание пакета из ${changes.length} предлагаемых изменений от пользователя ${userId}`);

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    const objectIds = [...new Set(changes.map(c => c.objectId))];
    const objects = await this.objectsRepository.find({
      where: { id: In(objectIds) }
    });
    const objectMap = new Map(objects.map(o => [o.id, o]));

    for (const objectId of objectIds) {
      if (!objectMap.has(objectId)) {
        throw new NotFoundException(`Объект с ID ${objectId} не найден`);
      }
    }

    const resolvedChanges = await Promise.all(
      changes.map(async (change) => {
        let photoId = change.photoId || null;

        if (change.changeType === 'photo' && !photoId && change.proposedData) {
          const { photoMaxData, photoMinData } = change.proposedData;

          if (photoMaxData && photoMinData) {
            const maxBuffer = Buffer.from(photoMaxData, 'base64');
            const minBuffer = Buffer.from(photoMinData, 'base64');

            const photo = await this.photosService.createFromBuffers(
              0,
              maxBuffer,
              minBuffer,
              userId,
            );

            photoId = photo.id;
            this.logger.log(`Создано фото ${photoId} с object_id=0 для предлагаемого изменения`);
          }
        }

        return { ...change, photoId };
      })
    );

    const entities = resolvedChanges.map(change => {
      const object = objectMap.get(change.objectId)!;

      return this.proposedChangesRepository.create({
        objectId: change.objectId,
        changeType: change.changeType,
        proposedData: change.proposedData || null,
        userId,
        userAbr: user.abr,
        objectBuhName: object.buhName,
        objectInvNumber: object.invNumber,
        objectSn: object.sn,
        photoId: change.photoId || null,
      });
    });

    const saved = await this.proposedChangesRepository.save(entities);
    this.logger.log(`Создано ${saved.length} записей в proposed_changes`);
    return saved;
  }

  /**
   * Получение всех предлагаемых изменений.
   * 
   * @returns Массив записей ProposedChange, отсортированных по дате создания (сначала новые)
   */
  async findAll(): Promise<ProposedChange[]> {
    this.logger.log('Получение всех предлагаемых изменений');
    return this.proposedChangesRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Получение предлагаемых изменений для конкретных складов.
   * Джойнит objects для фильтрации по zavod/sklad.
   * 
   * @param molAccess — массив { zavod, sklad } доступных МОЛу складов
   * @returns Массив записей ProposedChange
   */
  async findByMolAccess(molAccess: { zavod: number; sklad: string }[]): Promise<ProposedChange[]> {
    if (!molAccess.length) {
      return [];
    }

    this.logger.log(`Получение предлагаемых изменений для ${molAccess.length} складов`);

    const queryBuilder = this.proposedChangesRepository
      .createQueryBuilder('pc')
      .innerJoin('pc.object', 'obj')
      .orderBy('pc.created_at', 'DESC');

    const conditions = molAccess.map((access, index) => {
      const zavodParam = `zavod_${index}`;
      const skladParam = `sklad_${index}`;
      return `(obj.zavod = :${zavodParam} AND obj.sklad = :${skladParam})`;
    });

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`);

    molAccess.forEach((access, index) => {
      queryBuilder.setParameter(`zavod_${index}`, access.zavod);
      queryBuilder.setParameter(`sklad_${index}`, access.sklad);
    });

    const result = await queryBuilder.getMany();
    this.logger.log(`Найдено ${result.length} предлагаемых изменений`);
    return result;
  }

  /**
   * Утверждает предлагаемое изменение и применяет его к объекту.
   * После применения запись предложения удаляется.
   * 
   * @param id — ID записи предлагаемого изменения
   * @param userId — ID пользователя, утверждающего изменение (МОЛ)
   */
  async approve(id: number, userId: number): Promise<void> {
    this.logger.log(`Утверждение предлагаемого изменения с ID ${id}`);

    const change = await this.proposedChangesRepository.findOne({ where: { id } });
    if (!change) {
      throw new NotFoundException(`Предлагаемое изменение с ID ${id} не найдено`);
    }

    const object = await this.objectsRepository.findOne({ where: { id: change.objectId } });
    if (!object) {
      throw new NotFoundException(`Объект с ID ${change.objectId} не найден`);
    }

    switch (change.changeType) {
      case 'place':
        if (change.proposedData) {
          object.placeTer = change.proposedData.placeTer ?? object.placeTer;
          object.placePos = change.proposedData.placePos ?? object.placePos;
          object.placeCab = change.proposedData.placeCab ?? object.placeCab;
          object.placeUser = change.proposedData.placeUser ?? object.placeUser;
          await this.objectsRepository.save(object);
          this.logger.log(`Обновлено местоположение объекта ${object.id}`);
        }
        break;

      case 'sn':
        if (change.proposedData) {
          object.sn = change.proposedData.sn ?? null;
          await this.objectsRepository.save(object);
          this.logger.log(`Обновлён серийный номер объекта ${object.id}`);
        }
        break;

      case 'comment':
        // Комментарий утверждён — здесь можно добавить запись в логи объекта.
        // Пока просто логируем факт утверждения.
        this.logger.log(
          `Утверждён комментарий к объекту ${object.id}: ${change.proposedData?.comment || ''}`,
        );
        break;

      case 'photo':
        if (change.photoId) {
          await this.photosService.attachToObject(change.photoId, object.id);
          this.logger.log(`Фото ${change.photoId} привязано к объекту ${object.id}`);
        }
        break;

      default:
        this.logger.warn(`Неизвестный тип изменения: ${change.changeType}`);
    }

    // Удаляем запись предложения
    await this.remove(id);
    this.logger.log(`Предлагаемое изменение ${id} утверждено и удалено`);
  }

  /**
   * Удаление записи предлагаемого изменения.
   * 
   * ## Логика удаления фото
   * - Если у записи есть photo_id и фото отклонено (object_id = 0) — удаляется и фото, и запись.
   * - Если фото утверждено (object_id > 0) — удаляется только запись, фото остаётся.
   * - Если фото уже не существует — удаляется только запись.
   * 
   * @param id — ID записи
   * @param manager — опциональный менеджер транзакции (для вызова из пакетной обработки)
   */
  async remove(id: number, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(ProposedChange) : this.proposedChangesRepository;

    this.logger.log(`Удаление предлагаемого изменения с ID ${id}`);

    const change = await repo.findOne({ where: { id } });
    if (!change) {
      throw new NotFoundException(`Предлагаемое изменение с ID ${id} не найдено`);
    }

    if (change.photoId) {
      const photo = manager
        ? await manager.getRepository(Photo).findOne({ where: { id: change.photoId } })
        : await this.photosService.findOne(change.photoId);

      if (photo) {
        if (photo.objectId === 0) {
          if (manager) {
            await manager.getRepository(Photo).remove(photo);
          } else {
            await this.photosService.remove(photo.id);
          }
          await repo.remove(change);
          this.logger.log(`Предлагаемое изменение ${id} и фото ${photo.id} удалены (отклонено)`);
        } else {
          await repo.remove(change);
          this.logger.log(
            `Предлагаемое изменение ${id} удалено, фото ${photo.id} оставлено (утверждено, object_id=${photo.objectId})`,
          );
        }
      } else {
        await repo.remove(change);
        this.logger.log(`Предлагаемое изменение ${id} удалено, фото ${change.photoId} уже не существует`);
      }
    } else {
      await repo.remove(change);
      this.logger.log(`Предлагаемое изменение ${id} удалено`);
    }
  }

  /**
   * Пакетное удаление записей предлагаемых изменений.
   * Для каждой записи вызывает remove() с той же логикой удаления фото.
   * 
   * @param ids — массив ID записей для удаления
   * @param manager — опциональный менеджер транзакции
   */
  async removeBatch(ids: number[], manager?: EntityManager): Promise<void> {
    this.logger.log(`Пакетное удаление ${ids.length} предлагаемых изменений`);
    
    for (const id of ids) {
      await this.remove(id, manager);
    }
    
    this.logger.log(`Пакетное удаление завершено`);
  }
}