import { ref, computed, watch, toRef } from 'vue'
import { useStatementFilters } from './filters/useStatementFilters'
import { getFilterConfig } from './filters/filterConfig'

export function useFiltersManager(attachmentId, processedStatements) {
  // Фильтры
  const filters = ref(null)
  
  // Состояние модалки фильтра
  const showFilterModal = ref(false)
  const currentFilterColumn = ref('')
  const modalTitle = ref('')
  const filterOptions = ref([])
  const currentFilterValues = ref([])
  const isLoadingOptions = ref(false)

  // Вычисляемые свойства для передачи в компоненты
  const showFilterModalValue = computed(() => showFilterModal.value)
  const modalTitleValue = computed(() => modalTitle.value)
  const filterOptionsValue = computed(() => filterOptions.value)
  const isLoadingOptionsValue = computed(() => isLoadingOptions.value)
  
  // Безопасная версия currentFilterValues для передачи в компонент
  const safeCurrentFilterValues = computed(() => {
    // Гарантируем, что всегда возвращаем массив
    return Array.isArray(currentFilterValues.value) ? currentFilterValues.value : []
  })

  // Вычисляемые свойства для фильтров
  const activeFiltersObj = computed(() => {
    return filters.value?.activeFilters || {}
  })

  const hasActiveFilters = computed(() => {
    if (!filters.value) return false
    const active = activeFiltersObj.value
    return Object.values(active).some(values => values && values.length > 0)
  })

  const filteredStatements = computed(() => {
    if (!filters.value) {
      return processedStatements.value || []
    }
    
    if (hasActiveFilters.value) {
      return filters.value.filteredStatements || []
    }
    
    return processedStatements.value || []
  })

  // Инициализация фильтров
  watch(processedStatements, (newProcessedStatements) => {
    if (newProcessedStatements && newProcessedStatements.length > 0) {
      if (!filters.value) {
        // Первая инициализация фильтров
        const filterResult = useStatementFilters(attachmentId, newProcessedStatements)
        filters.value = filterResult
      } else {
        // Обновление данных в существующих фильтрах
        filters.value.updateData(newProcessedStatements)
      }
    }
  }, { immediate: true })

  /**
   * Открывает модалку фильтра для колонки
   */
  const openFilterModal = async (columnId) => {
    if (!filters.value) return
    
    currentFilterColumn.value = columnId
    modalTitle.value = getModalTitle(columnId)
    isLoadingOptions.value = true
    showFilterModal.value = true
    
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: гарантируем, что currentFilterValues всегда массив
    const activeFilter = filters.value.getActiveFilter(columnId)
    currentFilterValues.value = Array.isArray(activeFilter) ? activeFilter : []
    
    // Загружаем опции для фильтра
    try {
      filterOptions.value = filters.value.getFilterOptions(columnId)
    } catch (err) {
      console.error('Ошибка загрузки опций фильтра:', err)
      filterOptions.value = []
    } finally {
      isLoadingOptions.value = false
    }
  }

  /**
   * Закрывает модалку фильтра
   */
  const closeFilterModal = () => {
    showFilterModal.value = false
    currentFilterColumn.value = ''
    filterOptions.value = []
    currentFilterValues.value = []
  }

  /**
   * Применяет фильтр из модалки
   */
  const applyFilter = (selectedValues) => {
    if (filters.value) {
      filters.value.applyFilter(currentFilterColumn.value, selectedValues)
    }
    closeFilterModal()
  }

  /**
   * Сбрасывает текущий фильтр
   */
  const resetCurrentFilter = () => {
    if (filters.value) {
      filters.value.resetFilter(currentFilterColumn.value)
    }
    closeFilterModal()
  }

  /**
   * Сбрасывает все фильтры
   */
  const resetAllFilters = () => {
    if (filters.value) {
      filters.value.resetAllFilters()
    }
  }

  /**
   * Получает заголовок для модалки
   */
  const getModalTitle = (columnId) => {
    const config = getFilterConfig(columnId)
    if (config && config.modalTitle) {
      return config.modalTitle
    }
    
    const titles = {
      'inv_party_combined': 'Фильтр по инвентарному номеру',
      'buh_name': 'Фильтр по наименованию'
    }
    return titles[columnId] || `Фильтр по ${columnId}`
  }

  return {
    // Состояние для передачи в компоненты (computed - обычные значения)
    showFilterModal: showFilterModalValue,        // computed (Boolean)
    modalTitle: modalTitleValue,                 // computed (String)
    filterOptions: filterOptionsValue,           // computed (Array)
    currentFilterValues: safeCurrentFilterValues, // computed (Array)
    isLoadingOptions: isLoadingOptionsValue,      // computed (Boolean)
    
    // Вычисляемые свойства
    activeFiltersObj,         // computed (Object)
    hasActiveFilters,         // computed (Boolean)
    filteredStatements,       // computed (Array)
    
    // Методы
    openFilterModal,
    closeFilterModal,
    applyFilter,
    resetCurrentFilter,
    resetAllFilters
  }
}