/**
 * Хук для агрегации строк ведомости.
 * - Для isExcess строк: группировка по inv + party, синий цвет
 * - Для актуальных строк (isActual = true): группировка по inv + party
 * - Для неактуальных строк (isActual = false): группировка только по inv
 * 
 * @param {Ref<Array>} statements - ref с массивом исходных строк ведомости
 * @returns {Object} Объект с агрегированными данными
 */
import { computed } from 'vue'

export function useStatementAggregation(statements) {
  /**
   * Генерирует ключ группировки в зависимости от типа строки.
   * @param {Object} row - строка ведомости
   * @returns {string} ключ для группировки
   */
  const getGroupKey = (row) => {
    const inv = row.inv_number || row.invNumber || ''
    const party = row.party_number || row.partyNumber || ''
    
    if (row.isExcess) {
      return `excess_${inv}|${party}`
    }
    
    const isActual = row.is_actual ?? row.isActual ?? true
    if (!isActual) {
      return `inactive_${inv}`
    }
    
    return `active_${inv}|${party}`
  }

  /**
   * Определяет цвет группы.
   * @param {Object} group - сгруппированные данные
   * @returns {number} 6-синий, 1-красный, 2-жёлтый, 3-зелёный, 4-серый
   */
  const getGroupColor = (group) => {
    // isExcess — всегда синий
    if (group.isExcess) return 6
    
    // Неактивные — серый
    if (!group.isActual) return 4
    
    // Активные: по соотношению statements и objects
    if (group.objectCount === 0) return 1              // красный — объектов нет
    if (group.totalCount === group.objectCount) return 3 // зелёный — все строки с объектами
    return 2                                              // жёлтый — часть строк без объектов
  }

  /**
   * Форматирует отображение количества.
   * @param {Object} group - сгруппированные данные
   * @returns {string}
   */
  const formatDisplayQuantity = (group) => {
    if (group.isExcess) {
      return `(${group.totalCount} шт.)`
    }
    
    if (!group.isActual) {
      return `(${group.totalCount} шт.)`
    }
    
    // Для актуальных: если смешанная, показываем дробь
    if (group.objectCount !== group.totalCount && group.objectCount > 0) {
      return ` (${group.objectCount}/${group.totalCount} шт.)`
    }
    
    return ` (${group.totalCount} шт.)`
  }

  /**
   * Агрегированные строки.
   */
  const aggregatedStatements = computed(() => {
    if (!statements.value || statements.value.length === 0) {
      return []
    }

    const groupsMap = new Map()

    // ПЕРВЫЙ ПРОХОД: Группировка
    statements.value.forEach((row) => {
      const key = getGroupKey(row)
      const isExcess = row.isExcess || false
      const isActual = row.is_actual ?? row.isActual ?? true
      const objectCount = row.objectCount || 0
      
      if (!groupsMap.has(key)) {
        const isActiveGroup = key.startsWith('active_')
        const isExcessGroup = key.startsWith('excess_')
        
        groupsMap.set(key, {
          key,
          invNumber: row.inv_number || row.invNumber,
          partyNumber: (isActiveGroup || isExcessGroup) ? (row.party_number || row.partyNumber) : null,
          buhName: row.buh_name || row.buhName,
          zavod: row.zavod,
          sklad: row.sklad,
          totalCount: 0,
          objectCount: isExcessGroup ? objectCount : 0,
          isActual: isExcess ? true : isActual,
          isExcess: isExcess,
          originalRowsIds: [],
          isActiveGroup,
          isExcessGroup
        })
      }
      
      const group = groupsMap.get(key)
      group.totalCount++
      
      if (row.id && !isExcess) {
        group.originalRowsIds.push(row.id)
      }
    })

    // ВТОРОЙ ПРОХОД: Формирование результата
    const aggregatedRows = []
    
    for (const group of groupsMap.values()) {
      const groupColor = getGroupColor(group)
      
      aggregatedRows.push({
        invNumber: group.invNumber,
        partyNumber: group.partyNumber,
        buhName: group.buhName,
        zavod: group.zavod,
        sklad: group.sklad,
        groupCount: group.totalCount,
        objectCount: group.objectCount,
        isActual: group.isActual,
        isExcess: group.isExcess,
        groupColor: groupColor,
        displayQuantity: formatDisplayQuantity(group),
        originalRowIds: group.originalRowsIds,
        isAggregated: true,
        showParty: (group.isActiveGroup || group.isExcessGroup) && !!group.partyNumber
      })
    }
    
    // СОРТИРОВКА: синие(0) → красные(1) → жёлтые(2) → зелёные(3) → серые(4)
    return [...aggregatedRows].sort((a, b) => {
      if (a.groupColor !== b.groupColor) {
        return a.groupColor - b.groupColor
      }
      const nameA = (a.buhName || '').toLowerCase()
      const nameB = (b.buhName || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  })

  /**
   * Проверяет, нужно ли показывать блок партии/количества.
   * @param {Object} row - агрегированная строка
   * @returns {boolean}
   */
  const hasPartyOrQuantity = (row) => {
    const hasParty = row.showParty && row.partyNumber
    const hasQuantity = row.displayQuantity !== ''
    return hasParty || hasQuantity
  }

  /**
   * Возвращает группу строки для CSS-класса.
   * @param {Object} row - агрегированная строка
   * @returns {number}
   */
  const getRowGroup = (row) => {
    return row.groupColor ?? 4
  }

  return {
    aggregatedStatements,
    hasPartyOrQuantity,
    getRowGroup
  }
}