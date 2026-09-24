import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IgnoreKeyword } from '../entities/ignore-keyword.entity';
import { matchesAnyKeyword, compileKeywordsRegex, matchesCompiled } from './ignore-keywords.matcher';

@Injectable()
export class IgnoreKeywordsService {
    private readonly logger = new Logger(IgnoreKeywordsService.name);

    constructor(
        @InjectRepository(IgnoreKeyword)
        private readonly ignoreKeywordRepository: Repository<IgnoreKeyword>,
    ) {}

    // ... getKeywords, addKeyword, removeKeyword, replaceKeywords — без изменений

    /**
     * Проверка buh_name на соответствие игнор-словам пользователя.
     * Читает список из БД (кэшировать не нужно — вызывается не часто).
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
     * Заменить список игнор-слов и пересчитать isActual.
     * 
     * Логика:
     * 1. Полная замена списка слов в БД
     * 2. Загрузить все строки ведомостей пользователя
     * 3. Прогнать каждую через тот же матчер, что и парсер
     * 4. Одним UPDATE проставить isActual=true/false
     * 
     * @returns количество строк, помеченных isActual=false
     */
    async replaceAndApply(userId: number, keywords: string[]): Promise<number> {
        const normalized = [...new Set(
            keywords.map(k => k.trim()).filter(k => k.length > 0)
        )];

        // 1. Замена списка слов
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
        //    Нужны только id + buh_name — минимум данных
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

        // 4. Обновляем одним запросом
        // Сначала все в true, потом выбранные в false
        await this.ignoreKeywordRepository.manager
            .createQueryBuilder()
            .update('statements')
            .set({ isActual: true })
            .where('user_id = :userId', { userId })
            .execute();

        if (toDeactivate.length > 0) {
            // whereInIds + user_id для безопасности
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