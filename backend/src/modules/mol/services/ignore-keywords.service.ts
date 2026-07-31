import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgnoreKeyword } from '../entities/ignore-keyword.entity';

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

        const uniqueKeywords = [...new Set(keywords.map(k => k.trim()).filter(k => k.length > 0))];

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
        if (!buhName || !userId) {
            return false;
        }

        const keywords = await this.ignoreKeywordRepository.find({
            where: { userId },
            select: ['keyword'],
        });

        if (keywords.length === 0) {
            return false;
        }

        const normalizedBuhName = buhName.toLowerCase();

        for (const item of keywords) {
            const normalizedKeyword = item.keyword.toLowerCase();

            const regex = new RegExp(
                `(^|[\\s\\p{P}&&[^-]])${this.escapeRegExp(normalizedKeyword)}([\\s\\p{P}&&[^-]]|$)`,
                'iu'
            );

            if (regex.test(normalizedBuhName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Заменить список игнор-слов пользователя и пересчитать isActual в ведомостях.
     * 
     * ## Логика
     * 1. Заменяет все игнор-слова пользователя на новый список
     * 2. Всем строкам ведомостей пользователя ставит isActual = true
     * 3. Для каждого слова из нового списка проставляет isActual = false
     *    тем строкам, где buh_name содержит это слово (целое, регистронезависимо)
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

        // 2. Сбрасываем все isActual в true
        await this.ignoreKeywordRepository.manager
            .createQueryBuilder()
            .update('statements')
            .set({ isActual: true })
            .where('user_id = :userId', { userId })
            .execute();

        // 3. Для каждого слова проставляем isActual = false
        let totalUpdated = 0;

        for (const keyword of normalized) {
            const count = await this.setInactiveByKeyword(userId, keyword);
            totalUpdated += count;
        }

        this.logger.log(
            `Применены игнор-слова для пользователя ${userId}: ${totalUpdated} строк помечено неактуальными`
        );

        return totalUpdated;
    }

    /**
     * Установить isActual = false для всех строк ведомостей пользователя,
     * у которых buh_name содержит указанное ключевое слово.
     * 
     * @param userId - ID пользователя
     * @param keyword - Ключевое слово для поиска
     * @returns Количество обновлённых строк
     */
    private async setInactiveByKeyword(userId: number, keyword: string): Promise<number> {
        const result = await this.ignoreKeywordRepository.manager
            .createQueryBuilder()
            .update('statements')
            .set({ isActual: false })
            .where('user_id = :userId', { userId })
            .andWhere(
                `LOWER(buh_name) ~ :pattern`,
                { pattern: `\\m${this.escapeRegExp(keyword.toLowerCase())}\\M` }
            )
            .execute();

        return result.affected || 0;
    }

    /**
     * Экранирование специальных символов для RegExp.
     * 
     * @param text - Исходный текст
     * @returns Экранированный текст
     */
    private escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}