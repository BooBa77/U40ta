/**
 * Получает уникальные значения для колонки с учётом активных фильтров
 */
export function getUniqueValuesWithFilters(data, columnId, activeFilters) {
  console.log('🔎 getUniqueValuesWithFilters:', {
    dataLength: data?.length,
    columnId,
    activeFilters
  })
  
  // 1. Сначала фильтруем данные по другим активным фильтрам
  let filteredData = data
  
  Object.keys(activeFilters).forEach(filterColumnId => {
    if (filterColumnId !== columnId && activeFilters[filterColumnId]?.length > 0) {
      console.log('   Применяем фильтр для другой колонки:', filterColumnId)
      filteredData = filteredData.filter(row => 
        filterRowByConditions(row, { [filterColumnId]: activeFilters[filterColumnId] })
      )
      console.log('   Данных после фильтрации:', filteredData.length)
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
  const result = Array.from(valuesMap.values())
    .sort((a, b) => a.label.localeCompare(b.label))
  
  console.log('   Уникальных значений найдено:', result.length)
  return result
}

/**
 * Применяет фильтры к массиву данных
 */
export function applyFiltersToData(data, filters) {
  console.log('🎛️ applyFiltersToData:', {
    dataLength: data?.length,
    filters
  })
  
  if (!filters || Object.keys(filters).length === 0 || !data) {
    console.log('   Нет фильтров, возвращаем все данные')
    return data || []
  }
  
  console.log('   Применяем фильтры:', filters)
  const result = data.filter(row => filterRowByConditions(row, filters))
  console.log('   Результат:', result.length, 'строк')
  
  return result
}

/**
 * Проверяет строку на соответствие фильтрам
 * ИЗМЕНЕНО: теперь ТОЧНОЕ совпадение, а не текстовый поиск
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
    
    // ИЗМЕНЕНО: точное совпадение (или одно из значений)
    const matches = filterValues.some(filterValue => {
      const filterValueStr = String(filterValue).toLowerCase()
      // ТОЧНОЕ совпадение (без текстового поиска)
      const result = cellValueStr === filterValueStr
      console.log(`   Проверка: "${cellValueStr}" === "${filterValueStr}"? ${result}`)
      return result
    })
    
    if (!matches) {
      console.log(`   ❌ Строка не прошла фильтр ${columnId}`)
      return false
    }
  }
  
  console.log('   ✅ Строка прошла все фильтры')
  return true
}

/**
 * Вспомогательная: получает значение ячейки с учётом разных форматов данных
 */
function getCellValue(row, columnId) {
  console.log('   getCellValue для columnId:', columnId, 'row:', row.id || row.inv_number)
  
  // Прямое свойство
  if (row[columnId] !== undefined) {
    console.log('     Прямое свойство:', row[columnId])
    return row[columnId]
  }
  
  // Специальные обработки для объединённых колонок
  if (columnId === 'inv_number') {
    // Для фильтрации по инв. номеру
    const value = row.inv_number || row.invNumber || ''
    console.log('     inv_number значение:', value)
    return value
  }
  
  if (columnId === 'buh_name') {
    // Для фильтрации по наименованию
    const value = row.buh_name || row.buhName || ''
    console.log('     buh_name значение:', value)
    return value
  }
  
  // Попробуем camelCase вариант
  const camelCaseKey = columnId.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
  if (row[camelCaseKey] !== undefined) {
    console.log('     camelCase свойство:', row[camelCaseKey])
    return row[camelCaseKey]
  }
  
  console.log('     ❌ Значение не найдено')
  return ''
}