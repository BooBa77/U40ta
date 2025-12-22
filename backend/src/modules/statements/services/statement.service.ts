import { Injectable, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EmailAttachment } from '../../email/entities/email-attachment.entity';
import { ProcessedStatement } from '../entities/processed-statement.entity';
import { InventoryObject } from '../../objects/entites/object.entity';
import { AppEventsService } from '../../app-events/app-events.service';
import { StatementParserService } from './statement-parser.service';
import { StatementObjectsService } from './statement-objects.service'; // Создадим позже

@Injectable()
export class StatementService {
  constructor(
    // Репозитории для работы с БД
    @InjectRepository(EmailAttachment)
    private emailAttachmentRepo: Repository<EmailAttachment>,

    @InjectRepository(ProcessedStatement)
    private processedStatementRepo: Repository<ProcessedStatement>,

    @InjectRepository(Object)
    private objectRepo: Repository<Object>,

    // Сервис для парсинга Excel
    private statementParserService: StatementParserService,

    // Сервис для связи с объектами (создадим позже)
    // private statementObjectsService: StatementObjectsService,

    // Сервис для SSE уведомлений
    private appEventsService: AppEventsService,

    // Менеджер транзакций
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  /**
   * Основной метод: открывает ведомость, парсит при необходимости, возвращает данные
   * @param attachmentId ID вложения из таблицы email_attachments
   * @returns Массив записей processed_statements с актуальными have_object
   */
  async getStatement(attachmentId: number): Promise<ProcessedStatement[]> {
    console.log(`Запрос на открытие ведомости ID: ${attachmentId}`);

    // 1. Находим вложение
    const attachment = await this.emailAttachmentRepo.findOne({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${attachmentId} не найдено`);
    }

    // 2. Пропускаем инвентаризацию (пока не обрабатываем)
    if (attachment.is_inventory) {
      console.log(`Пропускаем инвентаризацию (ID: ${attachmentId})`);
      return [];
    }

    // 3. Проверяем обязательные поля
    if (!attachment.sklad || !attachment.doc_type) {
      throw new InternalServerErrorException(
        `У вложения отсутствует склад (${attachment.sklad}) или тип документа (${attachment.doc_type})`,
      );
    }

    // 4. Если ведомость уже в работе - возвращаем существующие записи
    if (attachment.in_process) {
      console.log(`Ведомость уже в работе, возвращаем существующие записи`);

      // В фоне обновляем have_object (на случай изменений объектов)
      // this.statementObjectsService.updateHaveObjects(
      //   attachment.sklad,
      //   attachment.doc_type,
      // ).catch(err => console.error('Ошибка фонового обновления:', err));

      return await this.processedStatementRepo.find({
        where: { emailAttachmentId: attachmentId },
        order: { id: 'ASC' },
      });
    }

    // 5. Проверяем наличие файла
    const filePath = this.statementParserService.getFilePath(attachment.filename);
    if (!require('fs').existsSync(filePath)) {
      throw new InternalServerErrorException(
        `Файл не найден: ${attachment.filename}`,
      );
    }

    // 6. НОВАЯ ВЕДОМОСТЬ - ТРАНЗАКЦИЯ
    let savedStatements: ProcessedStatement[] = [];

    try {
      savedStatements = await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          // 6.1. Находим старую активную ведомость того же склада и типа
          const oldActiveAttachment = await transactionalEntityManager.findOne(
            EmailAttachment,
            {
              where: {
                sklad: attachment.sklad,
                doc_type: attachment.doc_type,
                in_process: true,
                id: attachment.id, // исключаем текущую
              },
            },
          );

          // 6.2. Сбрасываем флаг у старой ведомости
          if (oldActiveAttachment) {
            await transactionalEntityManager.update(
              EmailAttachment,
              { id: oldActiveAttachment.id },
              { in_process: false },
            );
            console.log(
              `Сброшен флаг in_process у старой ведомости ID: ${oldActiveAttachment.id}`,
            );
          }

          // 6.3. Удаляем старые записи processed_statements этого склада/типа
          await transactionalEntityManager.delete(ProcessedStatement, {
            sklad: attachment.sklad,
            doc_type: attachment.doc_type,
          });
          console.log(
            `Удалены старые записи склада ${attachment.sklad}, тип ${attachment.doc_type}`,
          );

          // 6.4. Парсим Excel и создаём записи
          const excelRows = this.statementParserService.parseExcel(filePath);
          const newStatements =
            this.statementParserService.createStatementsFromExcel(
              excelRows,
              attachment,
            );

          // 6.5. Сохраняем новые записи
          const createdStatements = await transactionalEntityManager.save(
            ProcessedStatement,
            newStatements,
          );
          console.log(`Сохранено новых записей: ${createdStatements.length}`);

          // 6.6. Устанавливаем флаг у текущей ведомости
          await transactionalEntityManager.update(
            EmailAttachment,
            { id: attachmentId },
            { in_process: true },
          );
          console.log(`Установлен флаг in_process у ведомости ID: ${attachmentId}`);

          // 6.7. Возвращаем созданные записи
          return createdStatements;
        },
      );

      // 7. После успешной транзакции обновляем связи с объектами
      // await this.statementObjectsService.updateHaveObjects(
      //   attachment.sklad,
      //   attachment.doc_type,
      // );

      // 8. Отправляем SSE уведомление
      this.appEventsService.notifyEmailAttachmentsUpdated();
      console.log('Отправлено SSE уведомление на обновление списка файлов');

      // 9. Возвращаем результат
      return savedStatements;
    } catch (error) {
      console.error('Ошибка в транзакции:', error);
      throw new InternalServerErrorException(
        `Ошибка обработки ведомости: ${error.message}`,
      );
    }
  }

  /**
   * Полностью очищает все данные ведомости для указанного склада и типа
   * @param sklad Код склада
   * @param doc_type Тип документа ('ОСВ', 'ОС' и т.д.)
   */
  async clearStatements(sklad: string, doc_type: string): Promise<void> {
    console.log(`Очистка данных склада ${sklad}, тип ${doc_type}`);

    try {
      // 1. Удаляем все записи processed_statements для этого склада и типа
      await this.processedStatementRepo.delete({
        sklad: sklad,
        doc_type: doc_type,
      });
      console.log(`Удалены записи processed_statements`);

      // 2. Сбрасываем флаги in_process у всех email_attachments этого склада и типа
      await this.emailAttachmentRepo.update(
        {
          sklad: sklad,
          doc_type: doc_type,
          in_process: true,
        },
        { in_process: false },
      );
      console.log(`Сброшены флаги in_process у email_attachments`);

      // 3. Отправляем SSE уведомление
      this.appEventsService.notifyAll();
      console.log('Отправлено SSE уведомление об очистке');
    } catch (error) {
      console.error('Ошибка при очистке данных:', error);
      throw new InternalServerErrorException(
        `Ошибка очистки данных: ${error.message}`,
      );
    }
  }

  /**
   * Получает записи ведомости без какой-либо обработки (только чтение)
   * @param attachmentId ID вложения
   */
  async getStatementDataOnly(attachmentId: number): Promise<ProcessedStatement[]> {
    return await this.processedStatementRepo.find({
      where: { emailAttachmentId: attachmentId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Проверяет, есть ли активная ведомость для указанного склада и типа
   * @param sklad Код склада
   * @param doc_type Тип документа
   * @returns ID активной ведомости или null
   */
  async getActiveStatementId(
    sklad: string,
    doc_type: string,
  ): Promise<number | null> {
    const activeAttachment = await this.emailAttachmentRepo.findOne({
      where: {
        sklad: sklad,
        doc_type: doc_type,
        in_process: true,
      },
      select: ['id'],
    });

    return activeAttachment?.id || null;
  }
}