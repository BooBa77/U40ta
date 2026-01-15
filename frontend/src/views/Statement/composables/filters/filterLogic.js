/**
 * Получает уникальные значения для колонки с учётом активных фильтров
 * @param {Array} data - исходный массив данных
 * @param {string} columnId - ID колонки
 * @param {Object} activeFilters - активные фильтры других колонок {columnId: [values]}
 * @returns {Array} массив объектов {value, label, count}
 */
export function getUniqueValuesWithFilters(data, columnId, activeFilters) {
  // 1. Сначала фильтруем данные по другим активным фильтрам
  let filteredData = data
  
  Object.keys(activeFilters).forEach(filterColumnId => {
    if (filterColumnId !== columnId && activeFilters[filterColumnId]?.length > 0) {
      filteredData = filteredData.filter(row => 
        filterRowByConditions(row, { [filterColumnId]: activeFilters[filterColumnId] })
      )
    }
  })
  
  // 2. Собираем уникальные значения из отфильтрованных данных
  const valuesMap = new Map()
  
  filteredData.forEach(row => {
    const value = getCellValue(row, columnId)
    if (value !== undefined && value !== null && value !== '') {
      const key = String(value).toLowerCase()
      if (valuesMap.has(key)) {
        valuesMap.get(key).count++
      } else {
        valuesMap.set(key, {
          value: value,
          label: String(value),
          count: 1
        })
      }
    }
  })
  
  // 3. Сортируем по значению
  return Array.from(valuesMap.values())
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Применяет фильтры к массиву данных
 * @param {Array} data - исходный массив данных
 * @param {Object} filters - объект фильтров {columnId: [values]}
 * @returns {Array} отфильтрованный массив
 */
export function applyFiltersToData(data, filters) {
  if (!filters || Object.keys(filters).length === 0 || !data) {
    return data || []
  }
  
  return data.filter(row => filterRowByConditions(row, filters))
}

/**
 * Проверяет строку на соответствие фильтрам
 * @param {Object} row - строка данных
 * @param {Object} filters - объект фильтров {columnId: [values]}
 * @returns {boolean} true если строка проходит фильтрацию
 */
export function filterRowByConditions(row, filters) {
  if (!filters || Object.keys(filters).length === 0 || !row) {
    return true
  }
  
  // Проверяем каждый фильтр
  for (const [columnId, filterValues] of Object.entries(filters)) {
    if (!filterValues || filterValues.length === 0) {
      continue
    }
    
    const cellValue = getCellValue(row, columnId)
    const cellValueStr = String(cellValue || '').toLowerCase()
    
    // Проверяем совпадение с любым из значений фильтра (текстовый поиск)
    const matches = filterValues.some(filterValue => {
      const filterValueStr = String(filterValue).toLowerCase()
      // Ищем вхождение (текстовый поиск)
      return cellValueStr.includes(filterValueStr)
    })
    
    if (!matches) {
      return false
    }
  }
  
  return true
}

/**
 * Вспомогательная: получает значение ячейки с учётом разных форматов данных
 */
function getCellValue(row, columnId) {
  // Прямое свойство
  if (row[columnId] !== undefined) {
    return row[columnId]
  }
  
  // Специальные обработки для объединённых колонок
  if (columnId === 'inv_number') {
    // Для фильтрации по инв. номеру
    return row.inv_number || row.invNumber || ''
  }
  
  if (columnId === 'buh_name') {
    // Для фильтрации по наименованию
    return row.buh_name || row.buhName || ''
  }
  
  // Попробуем camelCase вариант
  const camelCaseKey = columnId.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
  if (row[camelCaseKey] !== undefined) {
    return row[camelCaseKey]
  }
  
  return ''
}