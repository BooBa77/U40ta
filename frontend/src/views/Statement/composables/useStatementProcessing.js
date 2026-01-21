/**
 * Хук для обработки данных ведомости с группировкой строк
 */

import { computed } from 'vue'

export function useStatementProcessing(statements) {
  /**
   * Обрабатывает исходные данные для группировки строк
   * Добавляет поля для управления отображением группированных строк
   */
  const processedStatements = computed(() => {
    if (!statements.value || statements.value.length === 0) {
      return []
    }
    
    const result = []
    
    // Объекты для отслеживания групп
    const ignoreGroups = {}  // Группы по is_ignore = true
    const objectGroups = {}  // Группы по have_object = true
    
    // ПЕРВЫЙ ПРОХОД: Определяем все группы
    statements.value.forEach((row, index) => {
      const inv = row.inv_number || row.invNumber || ''
      const party = row.party_number || row.partyNumber || ''
      const hasParty = party && party.trim() !== ''
      
      // Группировка по is_ignore (приоритетная)
      if (row.is_ignore && hasParty) {
        const key = `${inv}_${party}`
        if (!ignoreGroups[key]) {
          ignoreGroups[key] = {
            count: 0,
            firstIndex: index,
            firstRow: row
          }
        }
        ignoreGroups[key].count++
      }
      // Группировка по have_object (вторичная, только если не в группе игнора)
      else if (row.have_object && hasParty) {
        const key = `${inv}_${party}`
        if (!objectGroups[key]) {
          objectGroups[key] = {
            count: 0,
            firstIndex: index,
            firstRow: row
          }
        }
        objectGroups[key].count++
      }
    })
    
    // ВТОРОЙ ПРОХОД: Создаём обработанный массив с метаданными группировки
    statements.value.forEach((row, index) => {
      const inv = row.inv_number || row.invNumber || ''
      const party = row.party_number || row.partyNumber || ''
      const hasParty = party && party.trim() !== ''
      const ignoreKey = `${inv}_${party}`
      const objectKey = `${inv}_${party}`
      
      // Клонируем объект строки для добавления полей группировки
      const processedRow = { ...row }
      
      // Проверяем, попадает ли строка в группу игнора
      if (row.is_ignore && hasParty && ignoreGroups[ignoreKey]) {
        const group = ignoreGroups[ignoreKey]
        const isFirstInGroup = group.firstIndex === index
        
        if (isFirstInGroup) {
          // Это строка-представитель группы игнора
          processedRow.isGroupRepresentative = true
          processedRow.groupType = 'ignore'
          processedRow.groupCount = group.count
          processedRow.hiddenByGroup = false
        } else {
          // Это скрываемая строка группы игнора
          processedRow.isGroupRepresentative = false
          processedRow.groupType = 'ignore'
          processedRow.groupCount = 1
          processedRow.hiddenByGroup = true
        }
      }
      // Проверяем, попадает ли строка в группу have_object
      else if (row.have_object && hasParty && objectGroups[objectKey]) {
        const group = objectGroups[objectKey]
        const isFirstInGroup = group.firstIndex === index
        
        if (isFirstInGroup) {
          // Это строка-представитель группы have_object
          processedRow.isGroupRepresentative = true
          processedRow.groupType = 'object'
          processedRow.groupCount = group.count
          processedRow.hiddenByGroup = false
        } else {
          // Это скрываемая строка группы have_object
          processedRow.isGroupRepresentative = false
          processedRow.groupType = 'object'
          processedRow.groupCount = 1
          processedRow.hiddenByGroup = true
        }
      }
      // Строка не группируется
      else {
        processedRow.isGroupRepresentative = false
        processedRow.groupType = null
        processedRow.groupCount = 1
        processedRow.hiddenByGroup = false
      }
      
      result.push(processedRow)
    })
    
    return result
  })
  
  /**
   * Возвращает текст количества для группированных строк
   */
  const getGroupQuantityText = (row) => {
    if (row.isGroupRepresentative && row.groupCount > 1) {
      return `${row.groupCount} шт.`
    }
    return ''
  }
  
  /**
   * Проверяет, нужно ли показывать блок с партией
   */
  const hasPartyOrQuantity = (row) => {
    const party = row.party_number || row.partyNumber || ''
    const quantity = getGroupQuantityText(row)
    return party !== '' || quantity !== ''
  }
  
  return {
    processedStatements,
    getGroupQuantityText,
    hasPartyOrQuantity
  }
}