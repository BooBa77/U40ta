// qr-codes.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { QrCode } from './entities/qr-code.entity';
import { QrScanResult } from './interfaces/qr-scan-result.interface';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrOwnerDto } from './dto/update-qr-owner.dto';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode)
    private readonly qrCodesRepository: Repository<QrCode>,
  ) {}

  /**
   * Ищет объект по значению QR-кода (для сканирования)
   */
  async findObjectByQr(qrValue: string): Promise<QrScanResult> {
      const qrCode = await this.qrCodesRepository.findOne({
        where: { qrValue },
        relations: ['object'],
      });

      if (!qrCode) {
        return {
          success: false,
          qrValue,
          error: 'QR-код не найден',
        };
      }

      return {
        success: true,
        qrValue,
        objectId: qrCode.objectId ?? undefined,
        object: qrCode.object ? {
          invNumber: qrCode.object.invNumber,
          buhName: qrCode.object.buhName,
        } : undefined,
      };
  }

  /**
   * Универсальное сохранение: создаёт новый QR или обновляет привязку существующего
   */
  async save(
    qrValue: string,
    objectId: number,
    manager?: EntityManager,
  ): Promise<QrCode> {
    const repo = manager ? manager.getRepository(QrCode) : this.qrCodesRepository;

    const existing = await repo.findOne({ where: { qrValue } });

    if (existing) {
      existing.objectId = objectId;
      return repo.save(existing);
    } else {
      const qrCode = repo.create({ qrValue, objectId });
      return repo.save(qrCode);
    }
  }

  /**
   * Создание нового QR-кода (для обратной совместимости)
   */
  async create(createQrCodeDto: CreateQrCodeDto): Promise<QrCode> {
    return this.save(createQrCodeDto.qrValue, createQrCodeDto.objectId);
  }

  /**
   * Обновление владельца QR-кода (для обратной совместимости)
   */
  async updateOwner(updateQrOwnerDto: UpdateQrOwnerDto): Promise<{ success: boolean }> {
    await this.save(updateQrOwnerDto.qrValue, updateQrOwnerDto.newObjectId);
    return { success: true };
  }
}