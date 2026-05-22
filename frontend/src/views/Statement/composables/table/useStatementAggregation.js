/**
 * Хук для агрегации строк ведомости
 * - Для актуальных строк (isActual = true): группировка по inv + party
 * - Для неактуальных строк (isActual = false): группировка только по inv
 * @param {Ref<Array>} statements - ref с массивом исходных строк ведомости
 * @returns {Object} Объект с агрегированными данными
 */
import { computed } from 'vue'

export function useStatementAggregation(statements) {
  /**
   * Генерирует ключ группировки в зависимости от статуса актуальности
   * @param {Object} row - строка ведомости
   * @returns {string} ключ для группировки
   */
  const getGroupKey = (row) => {
    const inv = row.inv_number || row.invNumber || ''
    const isActual = row.is_actual ?? row.isActual ?? true
    
    if (!isActual) {
      // Неактуальные - группируем только по inv
      return `inactive_${inv}`
    }
    
    // Актуальные - группируем по inv + party
    const party = row.party_number || row.partyNumber || ''
    return `active_${inv}|${party}`
  }

  /**
   * Определяет цвет группы для актуальных строк
   * @param {Object} group - сгруппированные данные
   * @returns {number} 1-красный, 2-жёлтый, 3-зелёный
   */
  const getColorForActiveGroup = (group) => {
    // Все строки имеют объект - зелёный
    if (group.objectCount === group.totalCount) return 3
    
    // Все строки не имеют объекта - красный
    if (group.noObjectCount === group.totalCount) return 1
    
    // Смешанная ситуация - жёлтый
    return 2
  }

  /**
   * Форматирует отображение количества
   * @param {Object} group - сгруппированные данные
   * @param {boolean} isActive - актуальна ли группа
   * @returns {string}
   */
  const formatDisplayQuantity = (group, isActive) => {
    if (!isActive) {
      return `(${group.totalCount})`
    }
    
    // Для актуальных: если смешанная, показываем дробь
    if (group.objectCount !== group.totalCount && group.noObjectCount !== group.totalCount) {
      return ` (${group.objectCount}/${group.totalCount})`
    }
    
    return ` (${group.totalCount}шт.)`
  }

  /**
   * Агрегированные строки
   */
  const aggregatedStatements = computed(() => {
    if (!statements.value || statements.value.length === 0) {
      return []
    }

    const groupsMap = new Map()

    // ПЕРВЫЙ ПРОХОД: Группировка
    statements.value.forEach((row) => {
      const key = getGroupKey(row)
      const haveObject = row.have_object ?? row.haveObject ?? false
      const isActual = row.is_actual ?? row.isActual ?? true
      
      if (!groupsMap.has(key)) {
        // Определяем, будет ли эта группа отображать партию
        const isActiveGroup = key.startsWith('active_')
        
        groupsMap.set(key, {
          key,
          invNumber: row.inv_number || row.invNumber,
          partyNumber: isActiveGroup ? (row.party_number || row.partyNumber) : null,
          buhName: row.buh_name || row.buhName,
          zavod: row.zavod,
          sklad: row.sklad,
          totalCount: 0,
          objectCount: 0,
          noObjectCount: 0,
          isActual: isActual,
          originalRowsIds: [],
          isActiveGroup
        })
      }
      
      const group = groupsMap.get(key)
      
      group.totalCount++
      if (haveObject) {
        group.objectCount++
      } else {
        group.noObjectCount++
      }
      
      if (row.id) {
        group.originalRowsIds.push(row.id)
      }
    })

    // ВТОРОЙ ПРОХОД: Формирование результата
    const aggregatedRows = []
    
    for (const group of groupsMap.values()) {
      const groupColor = group.isActiveGroup 
        ? getColorForActiveGroup(group)
        : 4 // Неактивные - серая группа
      
      aggregatedRows.push({
        invNumber: group.invNumber,
        partyNumber: group.partyNumber,
        buhName: group.buhName,
        zavod: group.zavod,
        sklad: group.sklad,
        groupCount: group.totalCount,
        objectCount: group.objectCount,
        noObjectCount: group.noObjectCount,
        isActual: group.isActual,
        groupColor: groupColor,
        displayQuantity: formatDisplayQuantity(group, group.isActiveGroup),
        originalRowIds: group.originalRowsIds,
        isAggregated: true,
        showParty: group.isActiveGroup && !!group.partyNumber // Показывать партию только у активных и если она есть
      })
    }
    
    // СОРТИРОВКА: красные(1) → жёлтые(2) → зелёные(3) → серые(4)
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
   * Проверяет, нужно ли показывать блок партии/количества
   * @param {Object} row - агрегированная строка
   * @returns {boolean}
   */
  const hasPartyOrQuantity = (row) => {
    const hasParty = row.showParty && row.partyNumber
    const hasQuantity = row.displayQuantity !== ''
    return hasParty || hasQuantity
  }

  /**
   * Возвращает группу строки для CSS-класса
   * @param {Object} row - агрегированная строка
   * @returns {number}
   */
  const getRowGroup = (row) => {
    return row.groupColor || 4
  }

  return {
    aggregatedStatements,
    hasPartyOrQuantity,
    getRowGroup
  }
}