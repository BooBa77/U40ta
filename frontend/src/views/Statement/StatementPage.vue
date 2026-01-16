<template>
  <div class="statement-page">
    <div class="header">
      <button class="back-button" @click="$router.push('/')">← Назад</button>
      <h1>{{ statementTitle }}</h1>
      <button 
        v-if="hasActiveFilters"
        @click="resetAllFilters"
        class="reset-filters-btn"
        title="Сбросить все фильтры"
      >
        Сбросить фильтры
      </button>
    </div>
    
    <!-- Загрузка -->
    <div v-if="loading" class="loading">
      Загрузка ведомости...
    </div>
    
    <!-- Ошибка -->
    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="reload">Повторить</button>
    </div>
    
    <!-- Данные -->
    <div v-else class="content">
      <!-- Модалка фильтра -->
      <FilterModal
        v-if="showFilterModal"
        :is-open="showFilterModal"
        :title="modalTitle"
        :options="filterOptions"
        :selected-values="currentFilterValues"
        :is-loading="isLoadingOptions"
        @close="closeFilterModal"
        @apply="applyFilter"
        @reset="resetCurrentFilter"
      />
      
      <!-- Таблица -->
      <StatementTable 
        v-if="statements.length > 0"
        :statements="displayStatements"
        :columns="columns"
        :get-row-group="getRowGroup"
        :active-filters="activeFiltersObj"
        @filter-click="openFilterModal"
      />
      <div v-else class="empty">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import FilterModal from './components/FilterModal.vue'
import { useStatementData } from './composables/useStatementData'
import { useStatementColumns } from './composables/useStatementColumns'
import { useStatementFilters } from './composables/filters/useStatementFilters'

const route = useRoute()
const attachmentId = route.params.id

// Загружаем данные
const { loading, error, statements, reload, getRowGroup } = useStatementData(attachmentId)

// Заголовок ведомости
const statementTitle = computed(() => {
  if (!statements.value || statements.value.length === 0) {
    return `Ведомость #${attachmentId}`
  }
  
  const firstRow = statements.value[0]
  const type = firstRow.doc_type
  const warehouse = firstRow.sklad
  
  return `Ведомость ${type} ${warehouse}`
})

// Колонки таблицы
const columns = useStatementColumns()

// Фильтры - инициализируем позже, когда данные загрузятся
const filters = ref(null)

// Вычисляемые свойства
const activeFiltersObj = computed(() => {
  return filters.value?.activeFilters || {}
})

const hasActiveFilters = computed(() => {
  if (!filters.value) return false
  const active = activeFiltersObj.value
  return Object.values(active).some(values => values && values.length > 0)
})

// Вычисляемое свойство для отображения данных
const displayStatements = computed(() => {
  if (!filters.value) return statements.value || []
  
  if (hasActiveFilters.value) {
    return filters.value.filteredStatements || []
  }
  
  return statements.value || []
})

// Ждём загрузки данных
watch(statements, (newStatements) => {
  if (newStatements && newStatements.length > 0 && !filters.value) {
    // Инициализируем фильтры только после загрузки данных
    const filterResult = useStatementFilters(attachmentId, newStatements)
    filters.value = filterResult
  }
}, { immediate: true })

// Состояние модалки фильтра
const showFilterModal = ref(false)
const currentFilterColumn = ref('')
const modalTitle = ref('')
const filterOptions = ref([])
const currentFilterValues = ref([])
const isLoadingOptions = ref(false)

/**
 * Открывает модалку фильтра для колонки
 */
const openFilterModal = async (columnId) => {
  if (!filters.value) return
  
  currentFilterColumn.value = columnId
  modalTitle.value = getModalTitle(columnId)
  isLoadingOptions.value = true
  showFilterModal.value = true
  
  // Получаем текущие значения фильтра
  currentFilterValues.value = filters.value.getActiveFilter(columnId)
  
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
  const titles = {
    'inv_party_combined': 'Фильтр по инвентарному номеру',
    'buh_name': 'Фильтр по наименованию'
  }
  return titles[columnId] || `Фильтр по ${columnId}`
}
</script>

<style scoped>
@import './StatementPage.css';
</style>