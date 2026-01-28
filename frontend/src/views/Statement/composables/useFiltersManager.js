// useSimpleFiltersManager.js
import { ref, computed } from 'vue'

export function useSimpleFiltersManager(attachmentId, processedStatements) {
  console.log('[SIMPLE-FILTERS-MANAGER] Инициализация')
  
  // Состояние модалки фильтра - ref объекты
  const showFilterModal = ref(false)
  const modalTitle = ref('')
  const filterOptions = ref([])
  const currentFilterValues = ref([])
  const isLoadingOptions = ref(false)
  const currentFilterColumn = ref('')
  
  // Активные фильтры
  const activeFilters = ref({})
  
  /**
   * Открывает модалку фильтра для колонки
   */
  const openFilterModal = async (columnId) => {
    console.log('[SIMPLE-FILTERS-MANAGER] openFilterModal для колонки:', columnId)
    
    currentFilterColumn.value = columnId
    
    // Устанавливаем заголовок
    if (columnId === 'inv_party_combined') {
      modalTitle.value = 'Фильтр по инвентарному номеру'
    } else if (columnId === 'buh_name') {
      modalTitle.value = 'Фильтр по наименованию'
    } else {
      modalTitle.value = `Фильтр по ${columnId}`
    }
    
    showFilterModal.value = true
    isLoadingOptions.value = true
    
    // Текущие значения фильтра
    const filterKey = columnId === 'inv_party_combined' ? 'inv_number' : columnId
    currentFilterValues.value = activeFilters.value[filterKey] || []
    
    // Загружаем опции
    try {
      const statements = processedStatements.value || []
      const optionsMap = new Map()
      
      statements.forEach(row => {
        let value = ''
        if (filterKey === 'inv_number') {
          value = row.inv_number || row.invNumber || ''
        } else if (filterKey === 'buh_name') {
          value = row.buh_name || row.buhName || ''
        }
        
        if (value && value.trim()) {
          const key = String(value).toLowerCase()
          if (optionsMap.has(key)) {
            optionsMap.get(key).count++
          } else {
            optionsMap.set(key, {
              value: value,
              label: value,
              count: 1
            })
          }
        }
      })
      
      filterOptions.value = Array.from(optionsMap.values())
        .sort((a, b) => a.label.localeCompare(b.label))
      
      console.log('[SIMPLE-FILTERS-MANAGER] Загружено опций:', filterOptions.value.length)
    } catch (err) {
      console.error('[SIMPLE-FILTERS-MANAGER] Ошибка загрузки опций:', err)
      filterOptions.value = []
    } finally {
      isLoadingOptions.value = false
    }
  }
  
  /**
   * Закрывает модалку фильтра
   */
  const closeFilterModal = () => {
    console.log('[SIMPLE-FILTERS-MANAGER] closeFilterModal')
    showFilterModal.value = false
    currentFilterColumn.value = ''
    filterOptions.value = []
    currentFilterValues.value = []
  }
  
  /**
   * Применяет фильтр из модалки
   */
  const applyFilter = (selectedValues) => {
    console.log('[SIMPLE-FILTERS-MANAGER] applyFilter с значениями:', selectedValues)
    
    const filterKey = currentFilterColumn.value === 'inv_party_combined' ? 'inv_number' : currentFilterColumn.value
    
    if (!selectedValues || selectedValues.length === 0) {
      delete activeFilters.value[filterKey]
    } else {
      activeFilters.value[filterKey] = [...selectedValues]
    }
    
    closeFilterModal()
  }
  
  /**
   * Сбрасывает текущий фильтр
   */
  const resetCurrentFilter = () => {
    console.log('[SIMPLE-FILTERS-MANAGER] resetCurrentFilter')
    const filterKey = currentFilterColumn.value === 'inv_party_combined' ? 'inv_number' : currentFilterColumn.value
    delete activeFilters.value[filterKey]
    closeFilterModal()
  }
  
  /**
   * Сбрасывает все фильтры
   */
  const resetAllFilters = () => {
    console.log('[SIMPLE-FILTERS-MANAGER] resetAllFilters')
    activeFilters.value = {}
  }
  
  // Вычисляемые свойства (должны быть ПОСЛЕ объявления функций)
  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters.value).some(values => values && values.length > 0)
  })
  
  const filteredStatements = computed(() => {
    console.log('[SIMPLE-FILTERS-MANAGER] Вычисляем filteredStatements')
    
    if (!hasActiveFilters.value) {
      console.log('[SIMPLE-FILTERS-MANAGER] Нет активных фильтров, возвращаю processedStatements')
      return processedStatements.value || []
    }
    
    // Простая фильтрация
    const statements = processedStatements.value || []
    const filtered = statements.filter(row => {
      for (const [columnId, filterValues] of Object.entries(activeFilters.value)) {
        if (!filterValues || filterValues.length === 0) continue
        
        let cellValue = ''
        if (columnId === 'inv_number') {
          cellValue = row.inv_number || row.invNumber || ''
        } else if (columnId === 'buh_name') {
          cellValue = row.buh_name || row.buhName || ''
        }
        
        const matches = filterValues.some(filterValue => 
          String(cellValue).toLowerCase() === String(filterValue).toLowerCase()
        )
        
        if (!matches) return false
      }
      return true
    })
    
    console.log('[SIMPLE-FILTERS-MANAGER] Отфильтровано:', filtered.length, 'записей')
    return filtered
  })
  
  console.log('[SIMPLE-FILTERS-MANAGER] Возвращаю объект')
  return {
    // ref объекты
    showFilterModal,
    modalTitle,
    filterOptions,
    currentFilterValues,
    isLoadingOptions,
    activeFilters,
    
    // Вычисляемые свойства
    hasActiveFilters,
    filteredStatements,
    
    // Методы
    openFilterModal,
    closeFilterModal,
    applyFilter,
    resetCurrentFilter,
    resetAllFilters
  }
}