import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource для TypeORM CLI — только для команд
 * migration:generate / migration:run / migration:revert / migration:show.
 * Рантайм приложения (NestJS) использует свою конфигурацию в app.module.ts.
 *
 * Как и в ph, миграции ходят под отдельной ролью с правом на DDL
 * (`u40ta_migrator`), а не под ролью приложения (`u40ta_app`, только DML).
 * Поэтому сначала берутся MIGRATION_DB_*, и лишь если их нет — обычные DB_*.
 * Это защита от привычки: случайный `migration:run` под ролью приложения
 * ничего не изменит и упадёт с ошибкой прав, а не перепишет схему.
 *
 * Переменные окружения при запуске в контейнере приходят из compose;
 * при запуске с рабочей машины их нужно задать вручную (см. docs/u40ta/DATABASE.md).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.MIGRATION_DB_HOST ?? process.env.DB_HOST,
  port: Number(process.env.MIGRATION_DB_PORT ?? process.env.DB_PORT ?? 5432),
  username: process.env.MIGRATION_DB_USERNAME ?? process.env.DB_USERNAME,
  password: process.env.MIGRATION_DB_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.MIGRATION_DB_DATABASE ?? process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Никогда не включать: на боевой базе это затирает данные.
  synchronize: false,
});
