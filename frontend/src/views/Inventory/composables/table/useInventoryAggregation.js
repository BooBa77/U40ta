/**
 * Хук для агрегации строк инвентаризационной книги
 * Группирует строки по invNumber + partyNumber + sklad
 * Вычисляет статусы и цвета групп
 * 
 * @param {Ref<Array>} rawItems - ref с массивом сырых строк книги
 * @returns {Object} Объект с агрегированными данными
 */
import { computed } from 'vue'

export function useInventoryAggregation(rawItems) {
  /**
   * Статус группы для цветовой индикации (только для актуальных групп)
   * @param {Object} group — сгруппированные данные
   * @returns {'green'|'yellow'|'white'|'red'|'red-gray'}
   */
  const getGroupStatus = (group) => {
    const { okCount, totalCount, foundCount } = group

    if (okCount === totalCount) return 'green'
    if (okCount > 0) return 'yellow'
    if (foundCount === totalCount) return 'white'
    if (foundCount === 0) return 'red'
    return 'red-gray'
  }

  /**
   * Текст счётчика для ячейки
   * @param {Object} group — сгруппированные данные
   * @returns {string}
   */
  const getCounterText = (group) => {
    const { okCount, totalCount } = group
    if (okCount === totalCount) return String(okCount)
    if (okCount > 0) return `${okCount}/${totalCount}`
    return String(totalCount)
  }

  /**
   * Возвращает CSS-класс для строки таблицы
   * Приоритет: isActual=false → серая группа (4)
   * Для актуальных групп — цвет по статусу
   * 
   * @param {Object} group - сгруппированные данные
   * @returns {string} CSS-класс (row-group-0,1,2,3,4,5)
   */
  const getRowClass = (group) => {
    // Если группа неактуальна — серая группа (4)
    if (group.isActual === false) {
      return 'row-group-4'
    }
    
    // Для актуальных групп — цвет по статусу
    const map = {
      green: 'row-group-3',
      yellow: 'row-group-2',
      white: 'row-group-0',
      red: 'row-group-1',
      'red-gray': 'row-group-5'
    }
    return map[group.status] || 'row-group-4'
  }

  /**
   * Агрегированные строки с группировкой
   */
  const aggregatedItems = computed(() => {
    const items = rawItems.value || []
    if (items.length === 0) return []

    const groups = new Map()

    for (const item of items) {
      const key = `${item.invNumber}|${item.partyNumber || ''}|${item.sklad}`

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          invNumber: item.invNumber,
          partyNumber: item.partyNumber,
          sklad: item.sklad,
          buhName: item.buhName,
          isActual: item.isActual !== false, // true по умолчанию
          items: [],
          totalCount: 0,
          okCount: 0,
          foundCount: 0,
          notFoundCount: 0,
        })
      }

      const group = groups.get(key)
      group.items.push(item)
      group.totalCount++

      if (item.isOkManual || item.isOkAuto) group.okCount++
      if (item.idObject !== null && item.idObject !== undefined) {
        group.foundCount++
      } else {
        group.notFoundCount++
      }
    }

    // Формируем результат с добавлением computed полей
    const result = Array.from(groups.values()).map(group => ({
      ...group,
      status: getGroupStatus(group),
      counterText: getCounterText(group),
    }))

    // Сортировка: серые (неактуальные) вниз, внутри групп по наименованию
    return [...result].sort((a, b) => {
      // Сначала актуальные, потом неактуальные
      if (a.isActual !== b.isActual) {
        return a.isActual === false ? 1 : -1
      }
      // Внутри одной группы актуальности — по наименованию
      const nameA = (a.buhName || '').toLowerCase()
      const nameB = (b.buhName || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  })

  return {
    aggregatedItems,
    getRowClass
  }
}