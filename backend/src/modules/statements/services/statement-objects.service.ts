import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { InventoryObject } from '../../objects/entities/object.entity';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
//import { AppEventsService } from '../../app-events/app-events.service';

@Injectable()
export class StatementObjectsService {
  constructor(
    @InjectRepository(ProcessedStatement)
    private processedStatementRepo: Repository<ProcessedStatement>,
    
    @InjectRepository(InventoryObject)
    private inventoryObjectRepo: Repository<InventoryObject>,
    
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,
    
  //  private appEventsService: AppEventsService,
  ) {}

  /**
   * Основной метод: обновляет флаги have_object и создает записи is_excess
   * для активной ведомости указанного склада
   */
  async updateHaveObjectsForStatement(
    zavod: number,
    sklad: string,
    doc_type: string,
  ): Promise<void> {
    console.log(`StatementObjectsService: обновление флагов для ${zavod}/${sklad}/${doc_type}`);

    // 1. Находим активную ведомость
    const activeAttachment = await this.emailAttachmentRepo.findOne({
      where: {
        zavod,
        sklad,
        doc_type,
        in_process: true,
      },
    });

    if (!activeAttachment) {
      console.log(`StatementObjectsService: активная ведомость не найдена`);
      return;
    }

    // 2. Удаляем старые записи с is_excess = true для этой ведомости
    await this.processedStatementRepo.delete({
      emailAttachmentId: activeAttachment.id,
      is_excess: true,
    });
    console.log(`StatementObjectsService: удалены старые записи is_excess`);

    // 3. Получаем все объекты на этом складу
    const objects = await this.inventoryObjectRepo.find({
      where: { zavod, sklad },
      select: ['zavod', 'inv_number', 'party_number'],
    });

    // 4. Группируем объекты по ключу (zavod|inv_number|party_number) с подсчетом количества
    const objectCounts = new Map<string, number>();
    
    for (const obj of objects) {
      const key = `${obj.zavod}|${obj.inv_number}|${obj.party_number}`;
      objectCounts.set(key, (objectCounts.get(key) || 0) + 1);
    }

    console.log(`StatementObjectsService: найдено уникальных объектов: ${objectCounts.size}`);

    // 5. Получаем все записи ведомости (кроме is_excess)
    const statements = await this.processedStatementRepo.find({
      where: {
        emailAttachmentId: activeAttachment.id,
        is_excess: false,
      },
    });

    console.log(`StatementObjectsService: записей в ведомости: ${statements.length}`);

    // 6. Обновляем флаги have_object
    const updatedStatements: ProcessedStatement[] = [];
    
    for (const statement of statements) {
      const key = `${statement.zavod}|${statement.inv_number}|${statement.party_number}`;
      const count = objectCounts.get(key);

      if (count && count > 0) {
        // Объект найден
        statement.have_object = true;
        objectCounts.set(key, count - 1);
      } else {
        // Объект не найден
        statement.have_object = false;
      }
      
      updatedStatements.push(statement);
    }

    // 7. Сохраняем обновленные записи
    if (updatedStatements.length > 0) {
      await this.processedStatementRepo.save(updatedStatements);
      console.log(`StatementObjectsService: обновлено флагов have_object: ${updatedStatements.length}`);
    }

    // 8. Создаем записи is_excess для оставшихся объектов
    const excessStatements: ProcessedStatement[] = [];
    
    for (const [key, count] of objectCounts.entries()) {
      if (count > 0) {
        const [zavodStr, inv_number, party_number] = key.split('|');
        const zavodNum = parseInt(zavodStr, 10);

        // Создаем N записей по количеству оставшихся объектов
        for (let i = 0; i < count; i++) {
          const excess = new ProcessedStatement();
          excess.emailAttachmentId = activeAttachment.id;
          excess.zavod = zavodNum;
          excess.sklad = sklad;
          excess.doc_type = doc_type;
          excess.inv_number = inv_number;
          excess.party_number = party_number;
          excess.buh_name = `Объект отсутствует в ведомости`;
          excess.have_object = true; // объект есть в системе
          excess.is_excess = true;   // но его нет в ведомости
          
          excessStatements.push(excess);
        }
      }
    }

    // 9. Сохраняем записи is_excess
    if (excessStatements.length > 0) {
      await this.processedStatementRepo.save(excessStatements);
      console.log(`StatementObjectsService: создано записей is_excess: ${excessStatements.length}`);
    }

    console.log(`StatementObjectsService: обновление флагов завершено`);
  }
}