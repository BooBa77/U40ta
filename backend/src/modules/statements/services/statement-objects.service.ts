import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { InventoryObject } from '../../objects/entities/object.entity';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class StatementObjectsService {
  constructor(
    @InjectRepository(ProcessedStatement)
    private processedStatementRepo: Repository<ProcessedStatement>,
    
    @InjectRepository(InventoryObject)
    private inventoryObjectRepo: Repository<InventoryObject>,
    
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,
    
    private readonly appEventsService: AppEventsService,
  ) {}

  /**
   * Обновляет флаги haveObject и создает записи isExcess при перезагрузке
   * активной ведомости указанного склада
   */
  async updateHaveObjectsForStatement(
    zavod: number,
    sklad: string,
    docType: string,
  ): Promise<void> {
    //console.log(`StatementObjectsService: обновление флагов для ${zavod}/${sklad}/${docType}`);

    // 1. Находим активную ведомость
    const activeAttachment = await this.emailAttachmentRepo.findOne({
      where: {
        zavod,
        sklad,
        docType,
        inProcess: true,
      },
    });

    if (!activeAttachment) {
      //console.log(`StatementObjectsService: активная ведомость не найдена`);
      return;
    }

    // 2. Удаляем старые записи с isExcess = true для этой ведомости
    await this.processedStatementRepo.delete({
      emailAttachmentId: activeAttachment.id,
      isExcess: true,
    });
    //console.log(`StatementObjectsService: удалены старые записи isExcess`);

    // 3. Получаем все объекты на этом складу
    const objects = await this.inventoryObjectRepo.find({
      where: { zavod, sklad },
      select: ['zavod', 'invNumber', 'partyNumber'],
    });

    // 4. Группируем объекты по ключу (zavod|invNumber|partyNumber) с подсчетом количества
    const objectCounts = new Map<string, number>();
    
    for (const obj of objects) {
      const key = `${obj.zavod}|${obj.invNumber}|${obj.partyNumber}`;
      objectCounts.set(key, (objectCounts.get(key) || 0) + 1);
    }

    //console.log(`StatementObjectsService: найдено уникальных объектов: ${objectCounts.size}`);

    // 5. Получаем все записи ведомости (кроме isExcess)
    const statements = await this.processedStatementRepo.find({
      where: {
        emailAttachmentId: activeAttachment.id,
        isExcess: false,
      },
    });

    //console.log(`StatementObjectsService: записей в ведомости: ${statements.length}`);

    // 6. Обновляем флаги haveObject
    const updatedStatements: ProcessedStatement[] = [];
    
    for (const statement of statements) {
      const key = `${statement.zavod}|${statement.invNumber}|${statement.partyNumber}`;
      const count = objectCounts.get(key);

      if (count && count > 0) {
        // Объект найден
        statement.haveObject = true;
        objectCounts.set(key, count - 1);
      } else {
        // Объект не найден
        statement.haveObject = false;
      }
      
      updatedStatements.push(statement);
    }

    // 7. Сохраняем обновленные записи
    if (updatedStatements.length > 0) {
      await this.processedStatementRepo.save(updatedStatements);
    }

    // 8. Создаем записи isExcess для оставшихся объектов
    const excessStatements: ProcessedStatement[] = [];
    
    for (const [key, count] of objectCounts.entries()) {
      if (count > 0) {
        const [zavodStr, invNumber, partyNumber] = key.split('|');
        const zavodNum = parseInt(zavodStr, 10);

        // Создаем N записей по количеству оставшихся объектов
        for (let i = 0; i < count; i++) {
          const excess = new ProcessedStatement();
          excess.emailAttachmentId = activeAttachment.id;
          excess.zavod = zavodNum;
          excess.sklad = sklad;
          excess.docType = docType;
          excess.invNumber = invNumber;
          excess.partyNumber = partyNumber;
          excess.buhName = `Объект отсутствует в ведомости`;
          excess.haveObject = true; // объект есть в системе
          excess.isExcess = true;   // но его нет в ведомости
          
          excessStatements.push(excess);
        }
      }
    }

    // 9. Сохраняем записи isExcess
    if (excessStatements.length > 0) {
      await this.processedStatementRepo.save(excessStatements);
    }
  }

  /**
   * Задаёт haveObject для одной записи при создании объекта
   */
  async updateSingleHaveObject(statementId: number): Promise<void> {
    const statement = await this.processedStatementRepo.findOne({
      where: { id: statementId }  // ← убрали emailAttachmentId
    });

    if (!statement) return;

    // Проверяем, есть ли объект в системе
    const object = await this.inventoryObjectRepo.findOne({
      where: {
        zavod: statement.zavod,
        sklad: statement.sklad,
        invNumber: statement.invNumber,
        partyNumber: statement.partyNumber || '',
      }
    });

    statement.haveObject = !!object;
    await this.processedStatementRepo.save(statement);
    
    // Отправляем SSE уведомление об изменении ведомости
    this.appEventsService.notifyStatementUpdated(statementId);
  }
 
}