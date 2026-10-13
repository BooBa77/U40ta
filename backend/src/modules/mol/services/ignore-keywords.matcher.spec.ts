import { describe, it, expect } from 'vitest';
import {
  escapeRegExp,
  matchesAnyKeyword,
  compileKeywordsRegex,
  matchesCompiled,
} from './ignore-keywords.matcher';

/**
 * Тесты чистого сопоставления игнор-слов.
 *
 * Логика нетривиальная: поиск идёт по целому слову, а не по подстроке, поэтому
 * «сет» не должен находиться в «сетка», а дефис считается частью слова.
 * Ошибка здесь означает либо лишние строки, помеченные как игнорируемые, либо
 * пропущенные.
 */
describe('matchesAnyKeyword', () => {
  it('находит слово целиком', () => {
    expect(matchesAnyKeyword(['картридж'], 'Картридж HP 123')).toBe(true);
  });

  it('не находит слово внутри другого слова', () => {
    expect(matchesAnyKeyword(['сет'], 'Офисная сетка')).toBe(false);
  });

  it('не учитывает регистр', () => {
    expect(matchesAnyKeyword(['МФУ'], 'мфу canon')).toBe(true);
  });

  it('дефис считается частью слова: «картридж» не равно «картридж-тонер»', () => {
    expect(matchesAnyKeyword(['картридж'], 'картридж-тонер')).toBe(false);
    expect(matchesAnyKeyword(['картридж-тонер'], 'картридж-тонер HP')).toBe(true);
  });

  it('пунктуация вокруг слова не мешает', () => {
    expect(matchesAnyKeyword(['картридж'], 'Картридж, HP, 2024')).toBe(true);
  });

  it('спецсимволы регулярного выражения экранируются', () => {
    expect(matchesAnyKeyword(['сканер (hp)'], 'Сканер (HP) для отдела')).toBe(true);
    // Точка не должна работать как «любой символ»
    expect(matchesAnyKeyword(['hp.'], 'hpX')).toBe(false);
  });

  it('пустой список слов или пустой текст — совпадений нет', () => {
    expect(matchesAnyKeyword([], 'Картридж')).toBe(false);
    expect(matchesAnyKeyword(['картридж'], '')).toBe(false);
  });

  it('пустые строки в списке игнорируются', () => {
    expect(matchesAnyKeyword(['', '   '], 'Картридж')).toBe(false);
    expect(matchesAnyKeyword(['', 'картридж'], 'Картридж')).toBe(true);
  });

  it('достаточно любого слова из списка', () => {
    expect(matchesAnyKeyword(['мышь', 'клавиатура'], 'Клавиатура Logitech')).toBe(true);
  });
});

describe('escapeRegExp', () => {
  it('экранирует служебные символы', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegExp('(x)|[y]')).toBe('\\(x\\)\\|\\[y\\]');
  });
});

describe('compileKeywordsRegex и matchesCompiled', () => {
  it('без слов возвращает null', () => {
    expect(compileKeywordsRegex([])).toBeNull();
    expect(compileKeywordsRegex(['', '  '])).toBeNull();
  });

  it('находит любое из слов набора', () => {
    const regex = compileKeywordsRegex(['мышь', 'клавиатура']);
    expect(matchesCompiled(regex, 'Клавиатура Logitech')).toBe(true);
    expect(matchesCompiled(regex, 'мышь беспроводная')).toBe(true);
    expect(matchesCompiled(regex, 'монитор')).toBe(false);
  });

  it('повторные вызовы дают тот же результат (сброс lastIndex)', () => {
    const regex = compileKeywordsRegex(['мышь']);
    expect(matchesCompiled(regex, 'мышь')).toBe(true);
    expect(matchesCompiled(regex, 'мышь')).toBe(true);
  });

  it('null-regex и пустой текст — false', () => {
    expect(matchesCompiled(null, 'мышь')).toBe(false);
    expect(matchesCompiled(compileKeywordsRegex(['мышь']), '')).toBe(false);
  });
});
