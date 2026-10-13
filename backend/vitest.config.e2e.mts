import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Конфиг Vitest для e2e-тестов (test/**\/*.e2e-spec.ts).
 *
 * Вынесен отдельно от `vitest.config.mts`, потому что e2e поднимает всё
 * приложение целиком — вместе с подключением к базе. Настройки SWC те же:
 * без метаданных декораторов NestJS не соберёт граф зависимостей.
 *
 * У ph этот конфиг дополнительно уводит каталог загруженных файлов от боевого
 * хранилища; у u40ta файлового хранилища нет — фотографии лежат в базе, — так
 * что плагин не нужен.
 */
const swcPlugin = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2023',
  },
  module: { type: 'es6' },
});

export default defineConfig({
  test: {
    root: './',
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // Файлы прогоняются последовательно: тесты идут в одну живую базу,
    // параллельный запуск дал бы гонки.
    fileParallelism: false,
  },
  plugins: [swcPlugin],
});
