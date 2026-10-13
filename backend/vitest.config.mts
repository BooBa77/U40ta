import { defineConfig } from 'vitest/config';

/**
 * Конфиг Vitest для юнит-тестов (src/**\/*.spec.ts).
 *
 * Тот же, что в ph, — чтобы проекты запускали тесты одинаково.
 *
 * ## Зачем SWC, а не штатный транспайлер Vitest (esbuild)
 *
 * NestJS держится на emitDecoratorMetadata — по метаданным типов он понимает,
 * что подставлять в конструктор. esbuild эти метаданные не генерирует, и
 * внедрение зависимостей падает, не найдя провайдера. SWC умеет.
 *
 * ## Почему локально SWC отключается
 *
 * Нативный аддон SWC перед загрузкой проверяет ACL каталога кэша: каталог
 * должен принадлежать пользователю. В песочнице DSH это невыполнимо — и рабочий
 * каталог, и `%TEMP%` несут ACE песочницы, и проверка не проходит ни на одном
 * пути (пробовали `SWC_NATIVE_BINDING_CACHE` — тот же отказ). Поэтому локальный
 * запуск идёт без SWC: переменную `VITEST_NO_SWC=1` ставит
 * `../scripts/test-backend.ps1`.
 *
 * Что это значит на практике:
 *
 * * **локально** работают тесты, которым не нужен контейнер NestJS: чистая
 *   логика, сервисы без зависимостей, контроллеры с подставленными заглушками;
 * * **в CI и Docker** SWC подключается, поэтому там проходят и тесты с
 *   внедрением зависимостей.
 */
const useSwc = process.env.VITEST_NO_SWC !== '1';

/**
 * Плагин подключается динамически: статический `import 'unplugin-swc'` загрузил
 * бы нативный аддон ещё до проверки переменной, и локальный запуск падал бы на
 * проверке ACL — то есть ровно там, от чего мы уходим.
 */
const plugins = useSwc
  ? [
      (
        await import('unplugin-swc')
      ).default.vite({
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2023',
        },
        module: { type: 'es6' },
      }),
    ]
  : [];

export default defineConfig({
  test: {
    root: './',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/migrations/**'],
    },
  },
  plugins,
});
