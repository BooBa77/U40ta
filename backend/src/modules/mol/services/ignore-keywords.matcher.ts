/**
 * Чистая логика сопоставления buh_name с игнор-словами.
 * 
 * Без NestJS, без БД — легко тестируется.
 * Используется и в IgnoreKeywordsService, и (при желании) где угодно ещё.
 */

/**
 * Экранирование спецсимволов JS RegExp.
 */
export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Проверяет, содержит ли текст хотя бы одно из ключевых слов.
 *
 * Правила:
 * - Поиск по целому слову (не подстрока)
 * - Регистронезависимо (Unicode)
 * - Дефис считается частью слова
 * - Границы слова: начало/конец строки, пробел, пунктуация,
 *   но НЕ дефис, НЕ буква, НЕ цифра
 *
 * @param keywords - массив ключевых слов
 * @param text - текст для проверки (buh_name)
 * @returns true если найдено хотя бы одно совпадение
 */
export function matchesAnyKeyword(keywords: string[], text: string): boolean {
    if (!text || keywords.length === 0) return false;

    const normalizedText = text.toLowerCase();

    for (const kw of keywords) {
        const normalizedKw = kw.toLowerCase().trim();
        if (!normalizedKw) continue;

        const escaped = escapeRegExp(normalizedKw);

        // (?<![\p{L}\p{N}-]) — перед словом не буква, не цифра, не дефис
        // (?![\p{L}\p{N}-])  — после слова не буква, не цифра, не дефис
        const regex = new RegExp(
            `(?<![\\p{L}\\p{N}-])${escaped}(?![\\p{L}\\p{N}-])`,
            'iu'
        );

        if (regex.test(normalizedText)) return true;
    }

    return false;
}

/**
 * Компилирует ключевые слова в один RegExp (для массовой проверки).
 * Быстрее, чем N отдельных RegExp, если ключевых слов много.
 *
 * @param keywords - массив ключевых слов
 * @returns скомпилированный RegExp или null если слов нет
 */
export function compileKeywordsRegex(keywords: string[]): RegExp | null {
    const normalized = keywords
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

    if (normalized.length === 0) return null;

    // Сортируем по убыванию длины, чтобы более длинные слова
    // матчились первыми (важно при альтернации)
    const sorted = [...normalized].sort((a, b) => b.length - a.length);
    const alternation = sorted.map(escapeRegExp).join('|');

    return new RegExp(
        `(?<![\\p{L}\\p{N}-])(?:${alternation})(?![\\p{L}\\p{N}-])`,
        'iu'
    );
}

/**
 * Проверка через скомпилированный regex (для батч-операций).
 */
export function matchesCompiled(regex: RegExp | null, text: string): boolean {
    if (!regex || !text) return false;
    regex.lastIndex = 0;
    return regex.test(text);
}