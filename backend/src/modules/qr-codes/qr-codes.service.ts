import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode } from './entities/qr-code.entity';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
  ) {}

  async findAll(): Promise<QrCode[]> {
    return this.qrCodesRepository.find({});
  }
}