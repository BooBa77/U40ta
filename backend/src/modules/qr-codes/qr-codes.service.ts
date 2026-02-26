import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode } from './entities/qr-code.entity';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { UpdateQrOwnerDto } from './dto/update-qr-owner.dto';
import { QrScanResult } from './interfaces/qr-scan-result.interface';
import { QrCodesHistoryService } from '../qr-codes-history/qr-codes-history.service';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
    private qrCodesHistoryService: QrCodesHistoryService,
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
    
    // Сначала сохраняем, чтобы получить id
    const savedQrCode = await this.qrCodesRepository.save(qrCode);

    // Журналируем создание
    await this.qrCodesHistoryService.logChange({
      qr_code_id: savedQrCode.id,
      old_object_id: 0,  // 0 = создание нового QR-кода
      new_object_id: savedQrCode.object_id,
      changed_by: createQrCodeDto.changed_by, // нужно добавить в DTO
    });

    return savedQrCode;
  }

  // Переназначение QR
  async updateOwner(updateQrOwnerDto: UpdateQrOwnerDto): Promise<{ success: boolean }> {
    const { qr_value, new_object_id, changed_by } = updateQrOwnerDto;
    
    const qrCode = await this.qrCodesRepository.findOne({
      where: { qr_value }
    });

    if (!qrCode) {
      throw new NotFoundException(`QR-код ${qr_value} не найден`);
    }

    const old_object_id = qrCode.object_id;
    
    // Обновляем владельца
    qrCode.object_id = new_object_id;
    await this.qrCodesRepository.save(qrCode);
    
    // Журналируем изменение
    await this.qrCodesHistoryService.logChange({
      qr_code_id: qrCode.id,
      old_object_id,
      new_object_id,
      changed_by,
    });
    
    return {
      success: true
    };
  }  
}