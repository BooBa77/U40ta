import { IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTelegramUserDto } from './create-telegram-user.dto';

/**
 * DTO для обновления записи о пользователе Telegram
 * Все поля необязательные
 */
export class UpdateTelegramUserDto extends PartialType(CreateTelegramUserDto) {}