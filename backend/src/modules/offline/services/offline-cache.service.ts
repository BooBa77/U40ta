import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmailAttachment } from 'src/modules/email/entities/email-attachment.entity';
import { InventoryObject } from 'src/modules/objects/entities/object.entity';
import { ProcessedStatement } from 'src/modules/statements/entities/processed-statement.entity';
import { QrCode } from 'src/modules/qr-codes/entities/qr-code.entity';
import { MolAccess } from 'src/modules/users/entities/mol-access.entity';
import { InventoryBook } from 'src/modules/inventory/entities/inventory-book.entity';
import { InventoryBookItem } from 'src/modules/inventory/entities/inventory-book-item.entity';
import { RevisorAccess } from 'src/modules/inventory/entities/revisor-access.entity';


@Injectable()
export class OfflineCacheService {
  constructor(
    @InjectRepository(EmailAttachment)
    private emailAttachmentsRepository: Repository<EmailAttachment>,

    @InjectRepository(InventoryObject)
    private objectsRepository: Repository<InventoryObject>,
    
    @InjectRepository(ProcessedStatement)
    private statementsRepository: Repository<ProcessedStatement>,
    
    @InjectRepository(QrCode)
    private qrCodesRepository: Repository<QrCode>,
    
    @InjectRepository(MolAccess)
    private molAccessRepository: Repository<MolAccess>,

    @InjectRepository(InventoryBook)
    private inventoryBookRepo: Repository<InventoryBook>,

    @InjectRepository(InventoryBookItem)
    private inventoryBookItemRepo: Repository<InventoryBookItem>,

    @InjectRepository(RevisorAccess)
    private revisorAccessRepo: Repository<RevisorAccess>,    
  ) {}

  /**
   * Собирает данные для офлайн-режима для конкретного пользователя
   */
  async getAllData(userId: number): Promise<any> {
    console.log(`OfflineCacheService: получение данных для пользователя ${userId}`);
    
    try {
      // 1. Получаем доступные склады пользователя
      const userAccess = await this.molAccessRepository.find({
        where: { userId },
        select: ['zavod', 'sklad'],
      });
      
      // 2. Получаем ID книг, доступных ревизору
      const revisorAccess = await this.revisorAccessRepo.find({
        where: { userId: userId },
        select: ['idBook'],
      });
      const bookIds = revisorAccess.map(ra => ra.idBook);
      
      console.log(`OfflineCacheService: пользователь имеет доступ к ${bookIds.length} книгам`);
      
      // 3. Получаем ВСЕ объекты
      const objects = await this.objectsRepository.find({
        order: { id: 'ASC' },
      });
      
      // 4. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });
      
      // 5. Фотографии не кэшируем
      const photos: any[] = [];

      // 6. Получаем инвентаризационные книги и их строки
      let inventoryBooks: InventoryBook[] = [];
      let inventoryBookItems: InventoryBookItem[] = [];

      if (bookIds.length > 0) {
        inventoryBooks = await this.inventoryBookRepo.find({
          where: { id: In(bookIds) },
          order: { id: 'ASC' },
        });
        
        inventoryBookItems = await this.inventoryBookItemRepo.find({
          where: { idBook: In(bookIds) },
          order: { id: 'ASC' },
        });
        
        console.log(`OfflineCacheService: загружено книг: ${inventoryBooks.length}, строк: ${inventoryBookItems.length}`);
      }

      // 7. Получаем объекты ведомостей доступных складов
      let processedStatements: ProcessedStatement[] = [];
      let emailAttachments: EmailAttachment[] = [];

      if (userAccess.length > 0) {
        const whereConditions = userAccess.map(access => ({
          zavod: access.zavod,
          sklad: access.sklad,
        }));
        
        processedStatements = await this.statementsRepository.find({
          where: whereConditions,
          order: { id: 'ASC' },
        });
        
        const emailAttachmentIds = [...new Set(
          processedStatements
            .filter(s => s.emailAttachmentId)
            .map(s => s.emailAttachmentId)
        )];
        
        if (emailAttachmentIds.length > 0) {
          emailAttachments = await this.emailAttachmentsRepository.findBy({
            id: In(emailAttachmentIds)
          });
          emailAttachments = emailAttachments.filter(att => att.inProcess === true);
        }
      }

      // 8. Формируем ответ
      return {
        objects: objects,
        processed_statements: processedStatements,
        email_attachments: emailAttachments,
        qr_codes: qrCodes,
        photos: photos,
        inventory_books: inventoryBooks,
        inventory_book_items: inventoryBookItems,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalEmailAttachments: emailAttachments.length,
          totalStatements: processedStatements.length,
          totalObjects: objects.length,
          totalQrCodes: qrCodes.length,
          totalInventoryBooks: inventoryBooks.length,
          totalInventoryBookItems: inventoryBookItems.length,
        }
      };
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }
}