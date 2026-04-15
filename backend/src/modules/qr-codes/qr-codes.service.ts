import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode } from './entities/qr-code.entity';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrOwnerDto } from './dto/update-qr-owner.dto';
import { QrScanResult } from './interfaces/qr-scan-result.interface';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
  ) {}

  // Поиск объекта по QR
  async findObjectByQr(qrValue: string): Promise<QrScanResult> {
    const qrCode = await this.qrCodesRepository.findOne({
      where: { qrValue: qrValue },
    });

    if (!qrCode) {
      return {
        success: false,
        qrValue: qrValue,
        error: 'QR-код не найден',
      };
    }

    return {
      success: true,
      qrValue: qrValue,
      objectId: qrCode.objectId ?? undefined,
    };
  }

  // Создать QR
  async create(createQrCodeDto: CreateQrCodeDto, userId: number): Promise<QrCode> {
    const existing = await this.qrCodesRepository.findOne({
      where: { qrValue: createQrCodeDto.qrValue },
    });

    if (existing) {
      throw new ConflictException('QR-код уже существует');
    }

    const qrCode = this.qrCodesRepository.create(createQrCodeDto);
    const savedQrCode = await this.qrCodesRepository.save(qrCode);

    return savedQrCode;
  }

  // Переназначение QR
  async updateOwner(updateQrOwnerDto: UpdateQrOwnerDto, userId: number): Promise<{ success: boolean }> {
    const { qrValue, newObjectId } = updateQrOwnerDto;
    
    const qrCode = await this.qrCodesRepository.findOne({
      where: { qrValue }
    });

    if (!qrCode) {
      throw new NotFoundException(`QR-код ${qrValue} не найден`);
    }

    const oldObjectId = qrCode.objectId;
    
    qrCode.objectId = newObjectId;
    await this.qrCodesRepository.save(qrCode);
    
    return {
      success: true
    };
  }  
}