/**
 * Помощники для разбора ошибок, пойманных в `catch`.
 *
 * В строгом режиме (`strict`, а точнее `useUnknownInCatchVariables`, который в
 * него входит) переменная в `catch` имеет тип `unknown`: компилятор не знает,
 * что именно бросили — `Error`, строку или что-то ещё. Обращаться к
 * `error.message` напрямую нельзя, а `(error as Error).message` или `any`
 * вернули бы ошибку типизации обратно, только уже молча.
 *
 * Эти две функции — единственное место в проекте, где `unknown` превращается в
 * текст. Во всём остальном коде перехваченная ошибка остаётся честным
 * `unknown`, а к её содержимому обращаются через помощники.
 */

/**
 * Текст ошибки.
 *
 * Для `Error` — его `message`; для всего остального — строковое представление
 * (`String(error)`): так же повела бы себя подстановка в шаблонную строку.
 *
 * @param error - значение, пойманное в `catch`
 * @returns текст ошибки; всегда строка, потому что `String()` определён для
 *          любого значения
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Стек ошибки, если он есть.
 *
 * @param error - значение, пойманное в `catch`
 * @returns стек для `Error` и `undefined` для всего остального: у значения,
 *          которое не является `Error`, стека нет
 */
export function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
