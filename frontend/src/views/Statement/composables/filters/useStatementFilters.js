import { ref, computed } from 'vue'
import { saveFiltersToStorage, loadFiltersFromStorage, clearFiltersFromStorage } from './filterStorage'
import { getUniqueValuesWithFilters, applyFiltersToData } from './filterLogic'
import { isColumnFilterable, getFilterConfig } from './filterConfig'

export function useStatementFilters(attachmentId, statements) {
  
  // Состояние активных фильтров
  const activeFilters = ref({})
  
  // КРИТИЧНОЕ ИЗМЕНЕНИЕ: храним ссылку на данные внутри фильтров
  const statementsRef = ref(statements)
  const filteredStatements = ref([])
  
  /**
   * Внутренняя: применяет все активные фильтры к данным
   */
  const applyFilters = () => {
    
    filteredStatements.value = applyFiltersToData(statementsRef.value, activeFilters.value)
    
  }
  
  /**
   * Инициализация системы фильтров
   */
  const init = () => {
    if (!statementsRef.value || !Array.isArray(statementsRef.value)) {
      console.error('useStatementFilters: statements должен быть массивом', statementsRef.value)
      return
    }
    
    // Копируем данные
    filteredStatements.value = [...statementsRef.value]
    
    // Загружаем сохранённые фильтры
    const savedFilters = loadFiltersFromStorage(attachmentId)
    if (savedFilters && Object.keys(savedFilters).length > 0) {
      activeFilters.value = savedFilters
      applyFilters()
    } else {
    }
  }
  
  // Инициализируем сразу
  init()
  
  /**
   * НОВЫЙ МЕТОД: обновляет данные в фильтрах
   * @param {Array} newStatements - новые данные
   */
  const updateData = (newStatements) => {
    
    if (!newStatements || !Array.isArray(newStatements)) {
      console.error('useStatementFilters: updateData: newStatements должен быть массивом')
      return
    }
    
    // Обновляем данные
    statementsRef.value = newStatements
    
    // Пересчитываем фильтрацию
    applyFilters()
    
  }
  
  /**
   * Получает уникальные значения для модалки фильтра
   */
  const getFilterOptions = (columnId) => {
    
    if (!isColumnFilterable(columnId)) {
      return []
    }
    
    const config = getFilterConfig(columnId)
    const filterColumn = config.filterColumn || columnId
    
    const options = getUniqueValuesWithFilters(
      statementsRef.value, // Используем актуальные данные
      filterColumn,
      activeFilters.value
    )
    
    return options
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
    filteredStatements.value = [...statementsRef.value]
    clearFiltersFromStorage(attachmentId)
    
  }
  
  /**
   * Проверяет есть ли активные фильтры
   */
  const hasActiveFilters = computed(() => {
    const hasFilters = Object.values(activeFilters.value).some(values => 
      values && values.length > 0
    )
    return hasFilters
  })
  
  /**
   * Получает активный фильтр для колонки
   */
  const getActiveFilter = (columnId) => {
    const config = getFilterConfig(columnId)
    if (!config) return []
    
    const filterColumn = config.filterColumn || columnId
    const filterValues = activeFilters.value[filterColumn] || []
    
    return filterValues
  }
  
  return {
    // Состояние
    activeFilters,
    filteredStatements,
    hasActiveFilters,
    
    // Методы
    updateData,
    getFilterOptions,
    applyFilter,
    resetFilter,
    resetAllFilters,
    getActiveFilter,
    isColumnFilterable
  }
}