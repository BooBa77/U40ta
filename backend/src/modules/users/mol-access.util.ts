/**
 * Проверка доступа МОЛа к складу.
 *
 * Чистая функция: ни NestJS, ни базы, поэтому её легко тестировать. Используется
 * при утверждении предлагаемых изменений — утверждать может только МОЛ того
 * склада, где лежит объект.
 *
 * @param molAccess — склады, закреплённые за пользователем (`mol_access`)
 * @param zavod — номер завода объекта
 * @param sklad — склад объекта
 * @returns true, если пара «завод + склад» есть в доступах пользователя
 */
export function hasMolAccess(
  molAccess: readonly { zavod: number | string; sklad: string }[],
  zavod: number | string | null | undefined,
  sklad: string | null | undefined,
): boolean {
  // Без склада у объекта доступа быть не может: сравнивать не с чем.
  if (zavod === null || zavod === undefined || !sklad) return false;

  return molAccess.some(
    (access) =>
      Number(access.zavod) === Number(zavod) && access.sklad === sklad,
  );
}
