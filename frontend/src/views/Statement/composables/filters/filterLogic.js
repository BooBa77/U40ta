/**
 * Получает уникальные значения для колонки с учётом активных фильтров
 */
export function getUniqueValuesWithFilters(data, columnId, activeFilters) {
  // data может быть ref или массивом
  const dataArray = Array.isArray(data) ? data : data?.value || []
  
  if (!dataArray.length) return []
  
  // Остальной код без изменений
  let filteredData = dataArray
  
  Object.keys(activeFilters).forEach(filterColumnId => {
    if (filterColumnId !== columnId && activeFilters[filterColumnId]?.length > 0) {
      filteredData = filteredData.filter(row => 
        filterRowByConditions(row, { [filterColumnId]: activeFilters[filterColumnId] })
      )
    }
  })
}

/**
 * Применяет фильтры к массиву данных
 */
export function applyFiltersToData(data, filters) {
  
  if (!filters || Object.keys(filters).length === 0 || !data) {
    return data || []
  }
  
  const result = data.filter(row => filterRowByConditions(row, filters))
  
  return result
}

/**
 * Проверяет строку на соответствие фильтрам
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
    
    // Точное совпадение (или одно из значений)
    const matches = filterValues.some(filterValue => {
      const filterValueStr = String(filterValue).toLowerCase()
      const result = cellValueStr === filterValueStr
      return result
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