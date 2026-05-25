/**
 * Универсальный хук для фильтрации табличных данных
 * 
 * @param {Ref<Array>} data - ref с исходным массивом данных
 * @param {Array} columns - конфигурация фильтруемых колонок
 * @param {Object} options - дополнительные опции
 * @returns {Object} состояние фильтров и методы управления
 */
import { ref, computed } from 'vue'

export function useTableFilter(data, columns, options = {}) {
  const { debounceMs = 300, caseSensitive = false } = options
  
  // Состояние модалки
  const filterModalState = ref({
    isOpen: false,
    columnId: null,
    title: '',
    options: [],
    selectedValues: [],
    isLoading: false
  })
  
  // Активные фильтры
  const activeFilters = ref({})
  
  /**
   * Загружает уникальные значения для колонки с учётом активных фильтров
   * @param {string} columnId - идентификатор колонки
   * @returns {Array} массив уникальных значений с количеством
   */
  const loadColumnOptions = (columnId) => {
    const column = columns.find(c => c.id === columnId)
    if (!column) return []
    
    // Получаем текущие активные фильтры, исключая текущую колонку
    const otherFilters = { ...activeFilters.value }
    delete otherFilters[columnId]
    
    const items = data.value || []
    
    // Сначала фильтруем данные по другим активным фильтрам
    let filteredItems = items
    for (const [otherColumnId, filterValues] of Object.entries(otherFilters)) {
      if (!filterValues || filterValues.length === 0) continue
      
      const otherColumn = columns.find(c => c.id === otherColumnId)
      if (!otherColumn) continue
      
      filteredItems = filteredItems.filter(item => {
        const cellValue = otherColumn.getValue(item)
        const stringValue = String(cellValue || '')
        
        return filterValues.some(filterValue => {
          if (caseSensitive) {
            return stringValue === String(filterValue)
          }
          return stringValue.toLowerCase() === String(filterValue).toLowerCase()
        })
      })
    }
    
    // Теперь собираем уникальные значения для выбранной колонки из отфильтрованных данных
    const optionsMap = new Map()
    
    filteredItems.forEach(item => {
      const value = column.getValue(item)
      if (value !== undefined && value !== null && value !== '') {
        const key = String(value).toLowerCase()
        if (optionsMap.has(key)) {
          optionsMap.get(key).count++
        } else {
          optionsMap.set(key, {
            value: value,
            label: String(value),
            count: 1
          })
        }
      }
    })
    
    return Array.from(optionsMap.values())
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  /**
   * Открывает модалку фильтра для колонки
   * @param {string} columnId - идентификатор колонки
   */
  const openFilterModal = (columnId) => {
    const column = columns.find(c => c.id === columnId)
    if (!column) return
    
    filterModalState.value = {
      isOpen: true,
      columnId: columnId,
      title: column.title || `Фильтр по ${columnId}`,
      options: loadColumnOptions(columnId), // теперь пересчитывается каждый раз
      selectedValues: activeFilters.value[columnId] || [],
      isLoading: false
    }
  }
  
  /**
   * Закрывает модалку фильтра
   */
  const closeFilterModal = () => {
    filterModalState.value.isOpen = false
  }
  
  /**
   * Применяет фильтр
   * @param {Array} selectedValues - выбранные значения
   */
  const applyFilter = (selectedValues) => {
    const { columnId } = filterModalState.value
    if (!columnId) return
    
    if (!selectedValues || selectedValues.length === 0) {
      delete activeFilters.value[columnId]
    } else {
      activeFilters.value[columnId] = [...selectedValues]
    }
    
    closeFilterModal()
  }
  
  /**
   * Сбрасывает фильтр для текущей колонки
   */
  const resetCurrentFilter = () => {
    const { columnId } = filterModalState.value
    if (columnId) {
      delete activeFilters.value[columnId]
    }
    closeFilterModal()
  }
  
  /**
   * Сбрасывает все фильтры
   */
  const resetAllFilters = () => {
    console.log('[useTableFilter] resetAllFilters вызван, было:', activeFilters.value)
    activeFilters.value = {}
    console.log('[useTableFilter] resetAllFilters после:', activeFilters.value)
  }
  
  /**
   * Проверяет, активен ли фильтр для колонки
   * @param {string} columnId - идентификатор колонки
   * @returns {boolean}
   */
  const hasFilter = (columnId) => {
    const filters = activeFilters.value[columnId]
    return filters && filters.length > 0
  }
  
  /**
   * Есть ли активные фильтры
   */
  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters.value).some(f => f && f.length > 0)
  })
  
  /**
   * Отфильтрованные данные
   */
  const filteredData = computed(() => {
    const items = data.value || []
    
    if (!hasActiveFilters.value) {
      return items
    }
    
    return items.filter(item => {
      for (const [columnId, filterValues] of Object.entries(activeFilters.value)) {
        if (!filterValues || filterValues.length === 0) continue
        
        const column = columns.find(c => c.id === columnId)
        if (!column) continue
        
        const cellValue = column.getValue(item)
        const stringValue = String(cellValue || '')
        
        const matches = filterValues.some(filterValue => {
          if (caseSensitive) {
            return stringValue === String(filterValue)
          }
          return stringValue.toLowerCase() === String(filterValue).toLowerCase()
        })
        
        if (!matches) return false
      }
      return true
    })
  })
  
  return {
    // Состояние модалки
    filterModalState,
    
    // Активные фильтры
    activeFilters,
    
    // Вычисляемые
    hasActiveFilters,
    filteredData,
    
    // Методы
    openFilterModal,
    closeFilterModal,
    applyFilter,
    resetCurrentFilter,
    resetAllFilters,
    hasFilter
  }
}