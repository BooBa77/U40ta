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
      let statements: ProcessedStatement[] = [];
      let emailAttachments: EmailAttachment[] = []; // Объявляем переменную здесь, вне блока if

      if (userAccess.length > 0) {
        const whereConditions = userAccess.map(access => ({
          zavod: access.zavod,
          sklad: access.sklad,
        }));
        
        statements = await this.statementsRepository.find({
          where: whereConditions,
          order: { id: 'ASC' },
        });
        
        console.log(`OfflineCacheService: найдено ВСЕХ доступных объектов ведомостей: ${statements.length}`);

        // Собираем уникальные emailAttachmentId
        const emailAttachmentIds = [...new Set(
          statements
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

      // 6. Формируем ответ с правильной сериализацией
      return {
        objects: this.serializeObjects(objects),
        processed_statements: this.serializeStatements(statements),
        email_attachments: this.serializeEmailAttachments(emailAttachments), // Используем правильное имя переменной
        qr_codes: qrCodes,
        photos: photos,
        meta: {
          userId,
          fetchedAt: new Date().toISOString(),
          totalEmailAttachments: emailAttachments.length,
          totalStatements: statements.length,
          totalObjects: objects.length,
          totalQrCodes: qrCodes.length,
        }
      };
    } catch (error) {
      console.error('OfflineCacheService: ошибка при получении данных:', error);
      throw new Error(`Не удалось получить данные для офлайн-режима: ${error.message}`);
    }
  }

  /**
   *Сериализация объектов
   */
  private serializeEmailAttachments (attachments: EmailAttachment[]): any[] {
    return attachments.map(attachment => ({
      id: attachment.id,
      filename: attachment.filename,
      email_from: attachment.emailFrom,
      received_at: attachment.receivedAt,
      doc_type: attachment.docType,
      zavod: attachment.zavod,
      sklad: attachment.sklad,
      in_process: attachment.inProcess,
      is_inventory: attachment.isInventory,
    }));
  }

  private serializeObjects(objects: InventoryObject[]): any[] {
    return objects.map(obj => ({
      id: obj.id,
      zavod: obj.zavod,
      sklad: obj.sklad,
      buh_name: obj.buh_name,
      inv_number: obj.inv_number,
      party_number: obj.party_number,
      sn: obj.sn,
      is_written_off: obj.is_written_off,
      checked_at: obj.checked_at,
      place_ter: obj.place_ter,
      place_pos: obj.place_pos,
      place_cab: obj.place_cab,
      place_user: obj.place_user,
    }));
  }

  private serializeStatements(statements: ProcessedStatement[]): any[] {
    return statements.map(statement => ({
      id: statement.id,
      zavod: statement.zavod,
      sklad: statement.sklad,
      doc_type: statement.doc_type,
      inv_number: statement.inv_number,
      party_number: statement.party_number,
      buh_name: statement.buh_name,
      have_object: statement.have_object,
      is_ignore: statement.is_ignore,
      is_excess: statement.is_excess,
    }));
  }
}