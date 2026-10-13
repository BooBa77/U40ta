import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Проверка живости сервиса.
 *
 * Ничего не импортирует: `DataSource` приходит из `TypeOrmModule.forRoot()`,
 * который регистрируется в `AppModule` и доступен глобально.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
