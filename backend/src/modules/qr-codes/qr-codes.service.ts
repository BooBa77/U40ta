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
      where: { qr_value: qrValue },
    });

    if (!qrCode) {
      return {
        success: false,
        qr_value: qrValue,
        error: 'QR-код не найден',
      };
    }

    return {
      success: true,
      qr_value: qrValue,
      object_id: qrCode.object_id,
    };
  }

  // Создать QR
  async create(createQrCodeDto: CreateQrCodeDto): Promise<QrCode> {
    const existing = await this.qrCodesRepository.findOne({
      where: { qr_value: createQrCodeDto.qr_value },
    });

    if (existing) {
      throw new ConflictException('QR-код уже существует');
    }

    const qrCode = this.qrCodesRepository.create(createQrCodeDto);
    return this.qrCodesRepository.save(qrCode);
  }

  // Переназначение QR
  async updateOwner(updateQrOwnerDto: UpdateQrOwnerDto): Promise<any> {
    const { qr_value, new_object_id } = updateQrOwnerDto;
    
    // Находим QR-код
    const qrCode = await this.qrCodesRepository.findOne({
      where: { qr_value }
    });

    if (!qrCode) {
      throw new NotFoundException(`QR-код ${qr_value} не найден`);
    }

    // Обновляем владельца
    qrCode.object_id = new_object_id;
    
    await this.qrCodesRepository.save(qrCode);
    
    return {
      success: true,
      message: `Владелец QR-кода обновлён на объект ${new_object_id}`
    };
  }

  // Удалить QR
  async remove(qrValue: string): Promise<void> {
    const result = await this.qrCodesRepository.delete({ qr_value: qrValue });
    
    if (result.affected === 0) {
      throw new NotFoundException(`QR-код ${qrValue} не найден`);
    }
  }
}