import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Базовая миграция-маркер: схема u40ta создавалась руками, до появления миграций.
 *
 * Пустая намеренно — так же сделано в ph (1789286622391-Init.ts). Она не меняет
 * схему, а только отмечает точку отсчёта: всё, что было до неё, уже есть в базе.
 * Поэтому migration:run на боевой базе безопасен — создастся таблица
 * `migrations` и в неё ляжет эта запись, ни одна таблица не тронется.
 *
 * Полный снимок боевой схемы лежит в `fvds/backups/u40ta/schema/`
 * (`pg_dump --schema-only` от 12.10.2026, 15 таблиц). Из него можно собрать
 * настоящую baseline-миграцию, если понадобится поднимать базу с нуля —
 * см. `docs/u40ta/DATABASE.md`.
 */
export class Init1791780849494 implements MigrationInterface {
  name = 'Init1791780849494';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // намеренно пусто
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // намеренно пусто: откатывать нечего
  }
}