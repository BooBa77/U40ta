import { ref, computed } from 'vue'
import { saveFiltersToStorage, loadFiltersFromStorage, clearFiltersFromStorage } from './filterStorage'
import { getUniqueValuesWithFilters, applyFiltersToData } from './filterLogic'
import { isColumnFilterable, getFilterConfig } from './filterConfig'

export function useStatementFilters(attachmentId, statements) {
  // Состояние активных фильтров
  const activeFilters = ref({})
  const filteredStatements = ref([])
  
  /**
   * Внутренняя: применяет все активные фильтры к данным
   */
  const applyFilters = () => {
    filteredStatements.value = applyFiltersToData(statements, activeFilters.value)
  }
  
  /**
   * Инициализация системы фильтров
   */
  const init = () => {
    if (!statements || !Array.isArray(statements)) {
      console.error('useStatementFilters: statements должен быть массивом', statements)
      return
    }
    
    // Копируем данные
    filteredStatements.value = [...statements]
    
    // Загружаем сохранённые фильтры
    const savedFilters = loadFiltersFromStorage(attachmentId)
    if (savedFilters && Object.keys(savedFilters).length > 0) {
      activeFilters.value = savedFilters
      applyFilters()
    }
  }
  
  // Инициализируем сразу
  init()
  
  /**
   * Получает уникальные значения для модалки фильтра
   */
  const getFilterOptions = (columnId) => {
    if (!isColumnFilterable(columnId)) {
      return []
    }
    
    const config = getFilterConfig(columnId)
    const filterColumn = config.filterColumn || columnId
    
    return getUniqueValuesWithFilters(
      statements, // Исходные данные
      filterColumn,
      activeFilters.value
    )
  }
  
  /**
   * Применяет фильтр для колонки
   */
  const applyFilter = (columnId, selectedValues) => {
    if (!isColumnFilterable(columnId)) {
      return
    }
    
    const config = getFilterConfig(columnId)
    const filterColumn = config.filterColumn || columnId
    
    if (!selectedValues || selectedValues.length === 0) {
      // Удаляем фильтр если значений нет
      delete activeFilters.value[filterColumn]
    } else {
      // Устанавливаем фильтр
      activeFilters.value[filterColumn] = selectedValues
    }
    
    applyFilters()
    saveFiltersToStorage(attachmentId, activeFilters.value)
  }
  
  /**
   * Сбрасывает фильтр для конкретной колонки
   */
  const resetFilter = (columnId) => {
    if (!isColumnFilterable(columnId)) {
      return
    }
    
    const config = getFilterConfig(columnId)
    const filterColumn = config.filterColumn || columnId
    
    delete activeFilters.value[filterColumn]
    applyFilters()
    saveFiltersToStorage(attachmentId, activeFilters.value)
  }
  
  /**
   * Сбрасывает все фильтры
   */
  const resetAllFilters = () => {
    activeFilters.value = {}
    filteredStatements.value = [...statements]
    clearFiltersFromStorage(attachmentId)
  }
  
  /**
   * Проверяет есть ли активные фильтры
   */
  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters.value).some(values => 
      values && values.length > 0
    )
  })
  
  /**
   * Получает активный фильтр для колонки
   */
  const getActiveFilter = (columnId) => {
    const config = getFilterConfig(columnId)
    if (!config) return []
    
    const filterColumn = config.filterColumn || columnId
    return activeFilters.value[filterColumn] || []
  }
  
  return {
    // Состояние
    activeFilters,
    filteredStatements,
    hasActiveFilters,
    
    // Методы
    getFilterOptions,
    applyFilter,
    resetFilter,
    resetAllFilters,
    getActiveFilter,
    isColumnFilterable
  }
}