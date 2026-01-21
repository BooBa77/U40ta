<template>
  <div class="statement-page">
    <div class="header">
      <button class="back-button" @click="handleBack">← Назад</button>
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
        :has-party-or-quantity="hasPartyOrQuantity"
        @filter-click="openFilterModal"
        @ignore-change="handleIgnoreChange"
      />
      <div v-else class="empty">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import FilterModal from './components/FilterModal.vue'
import { useStatementData } from './composables/useStatementData'
import { useStatementColumns } from './composables/useStatementColumns'
import { useStatementFilters } from './composables/filters/useStatementFilters'
import { useStatementProcessing } from './composables/useStatementProcessing'
import { statementService } from './services/statement.service'

const route = useRoute()
const router = useRouter()
const attachmentId = route.params.id

// Загружаем данные
const { loading, error, statements, reload, getRowGroup } = useStatementData(attachmentId)

// Обрабатываем данные с группировкой - ОДИН РАЗ!
const { processedStatements, hasPartyOrQuantity } = useStatementProcessing(statements)

// ОТЛАДКА: проверяем данные
watch(statements, (newStatements) => {
  console.log('📦 Загружено statements:', newStatements?.length)
  if (newStatements?.length > 0) {
    console.log('Пример строки:', newStatements[0])
  }
}, { immediate: true })

watch(processedStatements, (newProcessed) => {
  console.log('🔧 Обработано processedStatements:', newProcessed?.length)
  if (newProcessed?.length > 0) {
    console.log('Пример обработанной строки:', newProcessed[0])
  }
}, { immediate: true })

// Заголовок ведомости
const statementTitle = computed(() => {
  if (!statements.value || statements.value.length === 0) {
    return ``
  }
  
  const firstRow = statements.value[0]
  const type = firstRow.doc_type
  const warehouse = firstRow.sklad
  
  return `${type} ${warehouse}`
})

// Колонки таблицы
const columns = useStatementColumns()

// Фильтры - инициализируем с ОБРАБОТАННЫМИ данными
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
  console.log('🔄 displayStatements вызван')
  console.log('   filters.value:', !!filters.value)
  console.log('   hasActiveFilters.value:', hasActiveFilters.value)
  
  if (!filters.value) {
    console.log('   ❌ Фильтры не инициализированы, возвращаем processedStatements:', processedStatements.value?.length)
    return processedStatements.value || []
  }
  
  if (hasActiveFilters.value) {
    console.log('   ✅ Есть активные фильтры, возвращаем filteredStatements:', filters.value.filteredStatements?.length)
    console.log('   Активные фильтры:', activeFiltersObj.value)
    return filters.value.filteredStatements || []
  }
  
  console.log('   ℹ️ Нет активных фильтров, возвращаем processedStatements:', processedStatements.value?.length)
  return processedStatements.value || []
})

// Ждём загрузки ОБРАБОТАННЫХ данных для фильтров
watch(processedStatements, (newProcessedStatements) => {
  console.log('👁️ watch processedStatements:', newProcessedStatements?.length)
  if (newProcessedStatements && newProcessedStatements.length > 0 && !filters.value) {
    console.log('✅ Инициализируем фильтры с данными:', newProcessedStatements.length)
    const filterResult = useStatementFilters(attachmentId, newProcessedStatements)
    filters.value = filterResult
    console.log('   Фильтры инициализированы:', !!filters.value)
  } else if (!newProcessedStatements?.length) {
    console.log('❌ Нет данных для инициализации фильтров')
  } else if (filters.value) {
    console.log('ℹ️ Фильтры уже инициализированы')
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
  console.log('Кнопка "Сбросить фильтры"')
  if (filters.value) {
    filters.value.resetAllFilters()
  }
}

// Хук для сброса фильтра при переходе на другую страницу
onBeforeRouteLeave((to, from) => {
  console.log('Покидаем страницу ведомости, сбрасываем фильтры')
  if (filters.value) {
    filters.value.resetAllFilters()
  }
})

// Хук для сброса фильтра при обновлении route (если перешли на другую ведомость)
onBeforeRouteUpdate((to, from) => {
  console.log('Обновляем route (другая ведомость), сбрасываем фильтры')
  if (filters.value) {
    filters.value.resetAllFilters()
  }
})

// Обработчик кнопки "Назад" - сброс фильтра БЕЗ подтверждения
const handleBack = () => {
  console.log('Кнопка "Назад", сбрасываем фильтры')
  if (filters.value) {
    filters.value.resetAllFilters()
  }
  router.push('/')
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

/**
 * Колонка Ignore
 */
const handleIgnoreChange = async ({ inv, party, is_ignore }) => {
  try {
    await statementService.updateIgnoreStatus(
      attachmentId,
      inv,
      party,
      is_ignore
    )
    // После успеха - релоад
    reload()
  } catch (error) {
    console.error('Ошибка обновления игнора:', error)
  }
}


</script>

<style scoped>
@import './StatementPage.css';
</style>