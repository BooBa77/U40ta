import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode } from './entities/qr-code.entity';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import { QrScanResult } from './interfaces/qr-scan-result.interface';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
  ) {}

  // Единственный нужный метод: поиск объекта по QR
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

  // Удалить QR
  async remove(qrValue: string): Promise<void> {
    const result = await this.qrCodesRepository.delete({ qr_value: qrValue });
    
    if (result.affected === 0) {
      throw new NotFoundException(`QR-код ${qrValue} не найден`);
    }
  }
}