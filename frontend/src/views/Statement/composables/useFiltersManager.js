/**
 * Хук для управления фильтрацией данных ведомости
 * Работает с агрегированными данными (camelCase поля)
 * 
 * @param {string|number} attachmentId - ID вложения (не используется в фильтрации, но нужен для API)
 * @param {Ref<Array>} aggregatedStatements - ref с агрегированными данными из useStatementAggregation
 * @returns {Object} Объект с состоянием фильтров и методами управления
 */
import { ref, computed } from 'vue'

export function useSimpleFiltersManager(attachmentId, aggregatedStatements) {
  console.log('[SimpleFiltersManager] Инициализация')

  // Состояние модалки фильтра
  const showFilterModal = ref(false)
  const modalTitle = ref('')
  const filterOptions = ref([])
  const currentFilterValues = ref([])
  const isLoadingOptions = ref(false)
  const currentFilterColumn = ref('')

  // Активные фильтры (хранят выбранные значения для каждой колонки)
  const activeFilters = ref({})

  /**
   * Открывает модалку фильтра для указанной колонки
   * Загружает уникальные значения из данных для выбранной колонки
   * 
   * @param {string} columnId - идентификатор колонки ('inv_party_combined' | 'buh_name')
   * @returns {Promise<void>}
   */
  const openFilterModal = async (columnId) => {
    console.log('[SimpleFiltersManager] openFilterModal для колонки:', columnId)

    currentFilterColumn.value = columnId

    // Настройка заголовка и ключа фильтра
    let filterKey = ''
    if (columnId === 'inv_party_combined') {
      filterKey = 'inv_number'
      modalTitle.value = 'Фильтр по инвентарному номеру'
    } else if (columnId === 'buh_name') {
      filterKey = 'buh_name'
      modalTitle.value = 'Фильтр по наименованию'
    } else {
      // Неподдерживаемая колонка
      return
    }

    showFilterModal.value = true
    isLoadingOptions.value = true

    // Загружаем текущие значения фильтра (если есть)
    currentFilterValues.value = activeFilters.value[filterKey] || []

    try {
      const statements = aggregatedStatements.value || []
      const optionsMap = new Map()

      // Собираем уникальные значения из данных
      statements.forEach((row) => {
        let value = ''
        if (filterKey === 'inv_number') {
          value = row.invNumber || ''
        } else if (filterKey === 'buh_name') {
          value = row.buhName || ''
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

      // Преобразуем в массив и сортируем по алфавиту
      filterOptions.value = Array.from(optionsMap.values())
        .sort((a, b) => a.label.localeCompare(b.label))

      console.log('[SimpleFiltersManager] Загружено опций:', filterOptions.value.length)
    } catch (err) {
      console.error('[SimpleFiltersManager] Ошибка загрузки опций:', err)
      filterOptions.value = []
    } finally {
      isLoadingOptions.value = false
    }
  }

  /**
   * Закрывает модалку фильтра и сбрасывает временное состояние
   * @returns {void}
   */
  const closeFilterModal = () => {
    console.log('[SimpleFiltersManager] closeFilterModal')
    showFilterModal.value = false
    currentFilterColumn.value = ''
    filterOptions.value = []
    currentFilterValues.value = []
  }

  /**
   * Применяет выбранные значения фильтра
   * @param {Array} selectedValues - массив выбранных значений для текущей колонки
   * @returns {void}
   */
  const applyFilter = (selectedValues) => {
    console.log('[SimpleFiltersManager] applyFilter с значениями:', selectedValues)

    // Определяем ключ для хранения фильтра
    const filterKey = currentFilterColumn.value === 'inv_party_combined'
      ? 'inv_number'
      : currentFilterColumn.value

    if (!selectedValues || selectedValues.length === 0) {
      // Удаляем фильтр, если ничего не выбрано
      delete activeFilters.value[filterKey]
    } else {
      // Сохраняем выбранные значения
      activeFilters.value[filterKey] = [...selectedValues]
    }

    closeFilterModal()
  }

  /**
   * Сбрасывает текущий активный фильтр (для колонки, по которой открыта модалка)
   * @returns {void}
   */
  const resetCurrentFilter = () => {
    console.log('[SimpleFiltersManager] resetCurrentFilter')

    const filterKey = currentFilterColumn.value === 'inv_party_combined'
      ? 'inv_number'
      : currentFilterColumn.value

    delete activeFilters.value[filterKey]
    closeFilterModal()
  }

  /**
   * Сбрасывает все активные фильтры (все колонки)
   * @returns {void}
   */
  const resetAllFilters = () => {
    console.log('[SimpleFiltersManager] resetAllFilters')
    activeFilters.value = {}
  }

  /**
   * Проверяет, есть ли активные фильтры
   * @type {ComputedRef<boolean>}
   */
  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters.value).some(values => values && values.length > 0)
  })

  /**
   * Отфильтрованные данные на основе активных фильтров
   * @type {ComputedRef<Array>}
   */
  const filteredStatements = computed(() => {
    console.log('[SimpleFiltersManager] Вычисляем filteredStatements')

    const statements = aggregatedStatements.value || []

    if (!hasActiveFilters.value) {
      console.log('[SimpleFiltersManager] Нет активных фильтров, возвращаю все данные')
      return statements
    }

    // Фильтрация по всем активным фильтрам
    const filtered = statements.filter(row => {
      for (const [columnId, filterValues] of Object.entries(activeFilters.value)) {
        if (!filterValues || filterValues.length === 0) continue

        let cellValue = ''
        if (columnId === 'inv_number') {
          cellValue = row.invNumber || ''
        } else if (columnId === 'buh_name') {
          cellValue = row.buhName || ''
        }

        // Проверяем, совпадает ли значение хотя бы с одним из выбранных
        const matches = filterValues.some(filterValue =>
          String(cellValue).toLowerCase() === String(filterValue).toLowerCase()
        )

        if (!matches) return false
      }
      return true
    })

    console.log('[SimpleFiltersManager] Отфильтровано:', filtered.length, 'записей из', statements.length)
    return filtered
  })

  console.log('[SimpleFiltersManager] Инициализация завершена')

  return {
    // Состояния (ref)
    showFilterModal,
    modalTitle,
    filterOptions,
    currentFilterValues,
    isLoadingOptions,
    activeFilters,

    // Вычисляемые свойства (computed)
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