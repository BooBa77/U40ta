import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCodesChange } from './entities/qr-codes-changes.entity';
import { CreateQrChangeDto } from './dto/create-qr-change.dto';

@Injectable()
export class QrCodesHistoryService {
  constructor(
    @InjectRepository(QrCodesChange)
    private changesRepository: Repository<QrCodesChange>,
  ) {}

  // основной метод для записи изменений. Принимает данные о том, какой QR-код меняли, с какого объекта на какой перевели, и кто это сделал
  async logChange(createQrChangeDto: CreateQrChangeDto): Promise<QrCodesChange> {
    const change = this.changesRepository.create(createQrChangeDto);
    return this.changesRepository.save(change);
  }

  //  показывает, какие изменения делал конкретный пользователь. Тоже сортирует по дате, чтобы видеть его последние действия
  async getHistoryByUser(userId: number): Promise<QrCodesChange[]> {
    return this.changesRepository.find({
      where: { changed_by: userId },
      order: { changed_at: 'DESC' },
    });
  }

  // возвращает последние изменения
  async getRecentChanges(limit: number = 50): Promise<QrCodesChange[]> {
    return this.changesRepository.find({
      order: { changed_at: 'DESC' },
      take: limit,
    });
  }
}