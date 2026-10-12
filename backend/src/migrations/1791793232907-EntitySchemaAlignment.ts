import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Приведение схемы к сущностям: типы ссылочных колонок и недостающий внешний ключ.
 *
 * ## Зачем
 *
 * Схема создавалась руками задолго до сущностей, и в ней накопились две
 * неточности, из-за которых `typeorm schema:log` не давал нуля.
 *
 * 1. Четыре колонки объявлены `integer`, хотя ссылаются на `bigint`-ключи
 *    `users.id` и `inventory_books.id`. Из-за этого TypeORM не мог объявить их
 *    внешние ключи по именам: связь `@ManyToOne` принудительно ставит колонке тип
 *    referenced-колонки, то есть добавление связи давало бы `ALTER COLUMN ...
 *    bigint` вместо устранения расхождения. Внешний ключ на `bigint`-ключ и
 *    должен быть `bigint` — это и выравнивается здесь.
 *
 * 2. У `qr_codes.object_id` внешнего ключа не было **вовсе**, хотя связь в
 *    сущности объявлена и используется кодом: `qr-codes.service.ts` строит ответ
 *    через `qrCode.object ? {...} : null`, то есть умеет работать с QR-кодом без
 *    объекта. Замысел был «при удалении объекта отсоединить QR-код»
 *    (`onDelete: 'SET NULL'`), но база его не доделала: колонка объявлена
 *    `NOT NULL`, а `SET NULL` на такую колонку — ловушка: удаление объекта
 *    падало бы с нарушением NOT NULL вместо отсоединения.
 *
 *    Поэтому здесь колонка становится nullable и добавляется ключ с `SET NULL` —
 *    так, как задумано в сущности. Данных это не меняет: `object_id` сейчас не
 *    пуст ни в одной из 309 строк, а приложение всегда создаёт QR-код с объектом.
 *
 * ## Безопасность
 *
 * Изменения неразрушающие: ни одного удаления данных. `integer` → `bigint` это
 * расширение типа, значения помещаются — проверено, что ни в одной из четырёх
 * колонок нет значений больше 2147483647. `DROP NOT NULL` лишь разрешает то, что
 * и так не встречается. Смена записи значения по умолчанию у `checked_at` —
 * косметика: `CURRENT_DATE` и `('now'::text)::date` на колонке `date` дают одно и
 * то же. Строк в таблицах немного (1 / 207 / 1).
 *
 * Имя нового ограничения — читаемое, в стиле остальных ключей проекта
 * (`mol_access_user_id_fkey`, `revisors_user_id_fkey`), а не хеш TypeORM.
 */
export class EntitySchemaAlignment1791793232907 implements MigrationInterface {
  name = 'EntitySchemaAlignment1791793232907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ссылочные колонки: внешний ключ на bigint должен быть bigint.
    await queryRunner.query(
      `ALTER TABLE "inventory_books" ALTER COLUMN "id_owner" TYPE bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_book_items" ALTER COLUMN "id_book" TYPE bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisor_access" ALTER COLUMN "id_book" TYPE bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisor_access" ALTER COLUMN "user_id" TYPE bigint`,
    );

    // 2. Недостающий внешний ключ: QR-код без объекта осмыслен (наклейку можно
    //    напечатать раньше, чем привязать), поэтому SET NULL, а не CASCADE.
    //    Колонку для этого приходится сделать nullable — иначе SET NULL
    //    превратился бы в ошибку при удалении объекта.
    await queryRunner.query(
      `ALTER TABLE "qr_codes" ALTER COLUMN "object_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_object_id_fkey" ` +
        `FOREIGN KEY ("object_id") REFERENCES "objects"("id") ` +
        `ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // 3. Значение по умолчанию у objects.checked_at.
    //    В базе оно записано как CURRENT_DATE, а TypeORM нормализует объявление
    //    `default: () => 'CURRENT_DATE'` в ('now'::text)::date и считает строки
    //    разными — снять это правкой сущности нельзя, проверено перебором
    //    вариантов. Семантика не меняется: на колонке date оба выражения дают
    //    сегодняшнюю дату. Записано именно так, как нормализует TypeORM, иначе
    //    расхождение вернётся.
    await queryRunner.query(
      `ALTER TABLE "objects" ALTER COLUMN "checked_at" SET DEFAULT ('now'::text)::date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objects" ALTER COLUMN "checked_at" SET DEFAULT CURRENT_DATE`,
    );
    await queryRunner.query(
      `ALTER TABLE "qr_codes" DROP CONSTRAINT "qr_codes_object_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "qr_codes" ALTER COLUMN "object_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisor_access" ALTER COLUMN "user_id" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisor_access" ALTER COLUMN "id_book" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_book_items" ALTER COLUMN "id_book" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_books" ALTER COLUMN "id_owner" TYPE integer`,
    );
  }
}
