import { IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO для обновления данных пользователя
 * Все поля необязательные
 * При обновлении имени/фамилии нужно пересчитывать abr
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}