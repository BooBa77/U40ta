import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmailAttachment } from 'src/modules/email/entities/email-attachment.entity';
import { InventoryObject } from 'src/modules/objects/entities/object.entity';
import { ProcessedStatement } from 'src/modules/statements/entities/processed-statement.entity';
import { QrCode } from 'src/modules/qr-codes/entities/qr-code.entity';
import { MolAccess } from 'src/modules/users/entities/mol-access.entity';


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
      
      console.log(`OfflineCacheService: пользователь имеет доступ к ${userAccess.length} складам`);
      
      // 2. Получаем ВСЕ объекты
      const objects = await this.objectsRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ объектов: ${objects.length}`);
      
      // 3. Получаем ВСЕ QR-коды
      const qrCodes = await this.qrCodesRepository.find({
        order: { id: 'ASC' },
      });
      
      console.log(`OfflineCacheService: загружено ВСЕХ QR-кодов: ${qrCodes.length}`);
      
      // 5. Фотографии не кэшируем. Может как-нибудь потом и явно не все
      const photos: any = [];

      // 4. Получаем объекты ведомостей доступных складов
      let processedStatements: ProcessedStatement[] = [];
      let emailAttachments: EmailAttachment[] = []; // Объявляем переменную здесь, вне блока if

      if (userAccess.length > 0) {
        const whereConditions = userAccess.map(access => ({
          zavod: access.zavod,
          sklad: access.sklad,
        }));
        
        processedStatements = await this.statementsRepository.find({
          where: whereConditions,
          order: { id: 'ASC' },
        });
        
        console.log(`OfflineCacheService: найдено ВСЕХ доступных объектов ведомостей: ${processedStatements.length}`);

        // Собираем уникальные emailAttachmentId
        const emailAttachmentIds = [...new Set(
          processedStatements
            .filter(s => s.emailAttachmentId)
            .map(s => s.emailAttachmentId)
        )];
        
        console.log(`OfflineCacheService: уникальных email_attachment_id: ${emailAttachmentIds.length}`);
        
        // Загружаем связанные email_attachments
        if (emailAttachmentIds.length > 0) {
          emailAttachments = await this.emailAttachmentsRepository.findBy({
            id: In(emailAttachmentIds)
          });          

          // Фильтруем: оставляем только те, у которых inProcess === true
          emailAttachments = emailAttachments.filter(att => att.inProcess === true);

          console.log(`OfflineCacheService: загружено email_attachments: ${emailAttachments.length}`);
        }
      } else {
        console.log('OfflineCacheService: у пользователя нет доступа к складам');
      }

      // 6. Формируем ответ
      return {
        objects: objects,
        processed_statements: processedStatements,
        email_attachments: emailAttachments,
        qr_codes: qrCodes,
        photos: photos,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalEmailAttachments: emailAttachments.length,
          totalStatements: processedStatements.length,
          totalObjects: objects.length,
          totalQrCodes: qrCodes.length,
        }
      };
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }
}