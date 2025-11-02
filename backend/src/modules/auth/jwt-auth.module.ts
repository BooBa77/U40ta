import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * JwtAuthModule - модуль для JWT аутентификации
 * Содержит только JwtAuthGuard и его зависимости
 * Может быть импортирован в любом модуле где нужна защита endpoints
 */
@Module({
  imports: [
    // ConfigModule для доступа к переменным окружения
    ConfigModule,
    
    // JwtModule для работы с JWT токенами
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '90d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Регистрируем JwtAuthGuard как провайдер
    JwtAuthGuard,
  ],
  exports: [
    // Экспортируем JwtAuthGuard для использования в других модулях
    JwtAuthGuard,
    
    // Также экспортируем JwtModule если другие модули будут генерировать токены
    JwtModule,
  ],
})
export class JwtAuthModule {}