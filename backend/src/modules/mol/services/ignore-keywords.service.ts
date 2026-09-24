import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgnoreKeyword } from '../entities/ignore-keyword.entity';
import {
    matchesAnyKeyword,
    compileKeywordsRegex,
    matchesCompiled,
} from './ignore-keywords.matcher';

/**
 * Сервис для управления игнор-словами МОЛов.
 *
 * ## Назначение
 * - Хранение ключевых слов, по которым строки ведомостей автоматически
 *   помечаются как неактуальные (isActual = false)
 * - Поиск по целому слову, регистронезависимо
 * - Дефис (-) считается частью слова
 *
 * ## Использование
 * - В парсере ведомостей (statement-parser.service.ts) для проверки buh_name
 * - В контроллере МОЛа (mol.controller.ts) для управления списком
 */
@Injectable()
export class IgnoreKeywordsService {
    private readonly logger = new Logger(IgnoreKeywordsService.name);

    constructor(
        @InjectRepository(IgnoreKeyword)
        private readonly ignoreKeywordRepository: Repository<IgnoreKeyword>,
    ) {}

    /**
     * Получить все игнор-слова пользователя.
     *
     * @param userId - ID пользователя (МОЛа)
     * @returns Массив ключевых слов, отсортированных по алфавиту
     */
    async getKeywords(userId: number): Promise<IgnoreKeyword[]> {
        return this.ignoreKeywordRepository.find({
            where: { userId },
            order: { keyword: 'ASC' },
        });
    }

    /**
     * Добавить новое игнор-слово для пользователя.
     *
     * @param userId - ID пользователя (МОЛа)
     * @param keyword - Ключевое слово (будет обрезано по краям)
     * @returns Созданная запись
     * @throws ConflictException если такое слово уже есть у пользователя
     */
    async addKeyword(userId: number, keyword: string): Promise<IgnoreKeyword> {
        const trimmed = keyword.trim();

        if (!trimmed) {
            throw new ConflictException('Ключевое слово не может быть пустым');
        }

        const existing = await this.ignoreKeywordRepository.findOne({
            where: { userId, keyword: trimmed },
        });

        if (existing) {
            throw new ConflictException(`Ключевое слово "${trimmed}" уже добавлено`);
        }

        const entity = this.ignoreKeywordRepository.create({
            userId,
            keyword: trimmed,
        });

        const saved = await this.ignoreKeywordRepository.save(entity);
        this.logger.log(`Добавлено игнор-слово "${trimmed}" для пользователя ${userId}`);
        return saved;
    }

    /**
     * Удалить игнор-слово по ID.
     *
     * @param id - ID записи
     * @param userId - ID пользователя (для проверки прав)
     * @throws NotFoundException если запись не найдена или не принадлежит пользователю
     */
    async removeKeyword(id: number, userId: number): Promise<void> {
        const entity = await this.ignoreKeywordRepository.findOne({
            where: { id, userId },
        });

        if (!entity) {
            throw new NotFoundException(
                `Игнор-слово с ID ${id} не найдено или не принадлежит вам`
            );
        }

        await this.ignoreKeywordRepository.delete(id);
        this.logger.log(`Удалено игнор-слово "${entity.keyword}" для пользователя ${userId}`);
    }

    /**
     * Полностью заменить список игнор-слов пользователя.
     * Используется при синхронизации из офлайн-режима.
     *
     * @param userId - ID пользователя
     * @param keywords - Новый список ключевых слов (массив строк)
     * @returns Количество добавленных записей
     */
    async replaceKeywords(userId: number, keywords: string[]): Promise<number> {
        await this.ignoreKeywordRepository.delete({ userId });

        const uniqueKeywords = [...new Set(
            keywords.map(k => k.trim()).filter(k => k.length > 0)
        )];

        if (uniqueKeywords.length === 0) {
            this.logger.log(`Список игнор-слов для пользователя ${userId} очищен`);
            return 0;
        }

        const entities = uniqueKeywords.map(keyword =>
            this.ignoreKeywordRepository.create({ userId, keyword })
        );

        const saved = await this.ignoreKeywordRepository.save(entities);
        this.logger.log(`Заменён список игнор-слов для пользователя ${userId}: ${saved.length} записей`);
        return saved.length;
    }

    /**
     * Проверяет, содержит ли buh_name какое-либо ключевое слово из списка МОЛа.
     * Поиск по целому слову, регистронезависимо. Дефис (-) считается частью слова.
     *
     * @param userId - ID пользователя (МОЛа)
     * @param buhName - Бухгалтерское наименование для проверки
     * @returns true если найдено совпадение, false если нет
     */
    async isIgnoredByKeywords(userId: number, buhName: string): Promise<boolean> {
        if (!buhName || !userId) return false;

        const keywords = await this.ignoreKeywordRepository.find({
            where: { userId },
            select: ['keyword'],
        });

        return matchesAnyKeyword(keywords.map(k => k.keyword), buhName);
    }

    /**
     * Заменить список игнор-слов пользователя и пересчитать isActual в ведомостях.
     *
     * ## Логика
     * 1. Заменяет все игнор-слова пользователя на новый список
     * 2. Загружает все строки ведомостей пользователя
     * 3. Прогоняет каждую через тот же матчер, что и парсер
     * 4. Обновляет isActual одним запросом
     *
     * @param userId - ID пользователя (МОЛа)
     * @param keywords - Новый список ключевых слов (массив строк)
     * @returns Количество обновлённых строк ведомостей
     */
    async replaceAndApply(userId: number, keywords: string[]): Promise<number> {
        const normalized = [...new Set(
            keywords.map(k => k.trim()).filter(k => k.length > 0)
        )];

        // 1. Заменяем список игнор-слов в БД
        await this.ignoreKeywordRepository.delete({ userId });

        if (normalized.length > 0) {
            const entities = normalized.map(keyword =>
                this.ignoreKeywordRepository.create({ userId, keyword })
            );
            await this.ignoreKeywordRepository.save(entities);
        }

        this.logger.log(
            `Список игнор-слов для пользователя ${userId} заменён: ${normalized.length} слов`
        );

        // 2. Загружаем все строки ведомостей пользователя
        const statements = await this.ignoreKeywordRepository.manager
            .createQueryBuilder()
            .select(['s.id AS id', 's.buh_name AS "buhName"'])
            .from('statements', 's')
            .where('s.user_id = :userId', { userId })
            .getRawMany<{ id: number; buhName: string }>();

        if (statements.length === 0) {
            this.logger.log(`У пользователя ${userId} нет строк ведомостей`);
            return 0;
        }

        // 3. Компилируем один regex на все слова — быстрее чем N regex
        const regex = compileKeywordsRegex(normalized);

        const toDeactivate: number[] = [];
        for (const st of statements) {
            if (matchesCompiled(regex, st.buhName)) {
                toDeactivate.push(st.id);
            }
        }

        // 4. Обновляем: сначала все в true, потом выбранные в false
        await this.ignoreKeywordRepository.manager
            .createQueryBuilder()
            .update('statements')
            .set({ isActual: true })
            .where('user_id = :userId', { userId })
            .execute();

        if (toDeactivate.length > 0) {
            await this.ignoreKeywordRepository.manager
                .createQueryBuilder()
                .update('statements')
                .set({ isActual: false })
                .where('user_id = :userId', { userId })
                .andWhere('id IN (:...ids)', { ids: toDeactivate })
                .execute();
        }

        this.logger.log(
            `Применены игнор-слова для пользователя ${userId}: ` +
            `${toDeactivate.length} из ${statements.length} строк помечено неактуальными`
        );

        return toDeactivate.length;
    }
}