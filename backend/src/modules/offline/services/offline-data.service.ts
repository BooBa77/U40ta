import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectOfflineHistory } from '../entities/offline-object-history.entity';

@Injectable()
export class OfflineDataService {
  constructor(
    @InjectRepository(ObjectOfflineHistory)
    private readonly offlineChangesRepository: Repository<ObjectOfflineHistory>,
  ) {}
}