import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProposedChange } from './entities/proposed-change.entity';
import { User } from '../users/entities/user.entity';
import { InventoryObject } from '../objects/entities/object.entity';
import { PhotosService } from '../photos/photos.service';

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
   * @param changes — массив изменений: { objectId, changeType, proposedData, photoId? }
   * @param userId — ID пользователя-гостя, предложившего изменения
   * @returns Массив созданных записей ProposedChange
   */
  async createBatch(
    changes: { objectId: number; changeType: string; proposedData?: Record<string, any>; photoId?: number }[],
    userId: number
  ): Promise<ProposedChange[]> {
    this.logger.log(`Создание пакета из ${changes.length} предлагаемых изменений от пользователя ${userId}`);

    // Получаем пользователя для ABR
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    // Получаем все объекты одним запросом
    const objectIds = [...new Set(changes.map(c => c.objectId))];
    const objects = await this.objectsRepository.find({
      where: { id: In(objectIds) }
    });
    const objectMap = new Map(objects.map(o => [o.id, o]));

    // Проверяем, что все объекты существуют
    for (const objectId of objectIds) {
      if (!objectMap.has(objectId)) {
        throw new NotFoundException(`Объект с ID ${objectId} не найден`);
      }
    }

    const entities = changes.map(change => {
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

    // Строим OR-условия для каждого склада
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
   * Удаление записи предлагаемого изменения.
   * Если запись содержит photo_id — фото удалится каскадно.
   * 
   * @param id — ID записи
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`Удаление предлагаемого изменения с ID ${id}`);
    
    const change = await this.proposedChangesRepository.findOne({ where: { id } });
    if (!change) {
      throw new NotFoundException(`Предлагаемое изменение с ID ${id} не найдено`);
    }

    await this.proposedChangesRepository.remove(change);
    this.logger.log(`Предлагаемое изменение с ID ${id} удалено`);
  }

  /**
   * Пакетное удаление записей предлагаемых изменений.
   * 
   * @param ids — массив ID записей для удаления
   */
  async removeBatch(ids: number[]): Promise<void> {
    this.logger.log(`Пакетное удаление ${ids.length} предлагаемых изменений`);
    
    const changes = await this.proposedChangesRepository.find({
      where: { id: In(ids) }
    });

    if (changes.length === 0) {
      throw new NotFoundException('Записи для удаления не найдены');
    }

    await this.proposedChangesRepository.remove(changes);
    this.logger.log(`Удалено ${changes.length} записей`);
  }
}