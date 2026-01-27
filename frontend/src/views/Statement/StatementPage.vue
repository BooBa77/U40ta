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
      
      <!-- Модалка ObjectForm -->
      <ObjectFormModal
        v-if="showObjectForm"
        :is-open="showObjectForm"
        :mode="objectFormData.mode"
        :initial-data="objectFormData.initialData"
        :qr-code="objectFormData.qrCode"
        @save="handleObjectFormSave"
        @cancel="handleObjectFormCancel"
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
        @qr-scan="handleQrScan"
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
import { useStatementFilters } from './composables/useStatementFilters'
import { useStatementProcessing } from './composables/useStatementProcessing'
import { statementService } from './services/statement.service'
import { qrService } from '@/components/QrScanner/services/qr.service'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'

const route = useRoute()
const router = useRouter()
const attachmentId = route.params.id

// Загружаем данные
const { loading, error, statements, reload, getRowGroup } = useStatementData(attachmentId)

// Обрабатываем данные с группировкой
const { processedStatements, hasPartyOrQuantity } = useStatementProcessing(statements)

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

// Фильтры
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
  
  if (!filters.value) {
    return processedStatements.value || []
  }
  
  if (hasActiveFilters.value) {
    return filters.value.filteredStatements || []
  }
  
  return processedStatements.value || []
})

// Обновляем логику инициализации фильтров
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

// Хук для сброса фильтра при переходе на другую страницу
onBeforeRouteLeave((to, from) => {
  if (filters.value) {
    filters.value.resetAllFilters()
  }
})

// Хук для сброса фильтра при обновлении route
onBeforeRouteUpdate((to, from) => {
  if (filters.value) {
    filters.value.resetAllFilters()
  }
})

// Обработчик кнопки "Назад" - сброс фильтра БЕЗ подтверждения
const handleBack = () => {
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

/**
 * Обработчик сканирования QR
 */
const handleQrScan = async ({ qrCode, rowData }) => {
  console.log('QR сканирование из таблицы:', {
    qrCode,
    rowData,
    attachmentId
  })
  
  try {
    // Пробуем проверить QR через сервис
    let qrCheckResult = null
    
    try {
      qrCheckResult = await qrService.getQrCodeWithObject(qrCode)
      console.log('Результат проверки QR:', qrCheckResult)
    } catch (apiError) {
      console.warn('API проверки QR недоступно (ожидаемо):', apiError.message)
      // Продолжаем работу без проверки
    }
    
    if (!qrCheckResult) {
      // QR не найден в БД (или API недоступно) - создаём новый
      console.log('QR-код не найден, открываем форму создания')
      
      const confirmed = confirm(
        `QR-код: ${qrCode}\n\n` +
        `Для объекта:\n` +
        `• Инв. номер: ${rowData.inv_number || rowData.invNumber}\n` +
        `• Наименование: ${rowData.buh_name || rowData.buhName}\n\n` +
        `Создать новый объект с этим QR?`
      )
      
      if (confirmed) {
        openObjectForm({
          mode: 'create',
          qrCode: qrCode,
          rowData: rowData
        })
      }
    } else {
      // QR найден - предлагаем перепривязать
      const { qrRecord, objectData } = qrCheckResult
      
      const confirmed = confirm(
        `⚠️ ВНИМАНИЕ!\n\n` +
        `QR-код уже привязан к объекту:\n` +
        `• Инв. номер: ${objectData.inv_number || 'не указан'}\n` +
        `• Наименование: ${objectData.buh_name || 'не указано'}\n` +
        `• Склад: ${objectData.zavod || '?'}/${objectData.sklad || '?'}\n\n` +
        `Перепривязать к новому объекту?\n` +
        `Новый объект: ${rowData.inv_number || rowData.invNumber}`
      )
      
      if (confirmed) {
        openObjectForm({
          mode: 'reassign',
          qrCode: qrCode,
          existingObjectId: qrRecord.object_id,
          existingObjectData: objectData,
          rowData: rowData
        })
      }
    }
    
  } catch (error) {
    console.error('Ошибка обработки QR:', error)
    alert(`Ошибка: ${error.message}`)
  }
}

const showObjectForm = ref(false)
const objectFormData = ref({
  mode: 'create',
  initialData: {},
  qrCode: ''
})

/**
 * Открывает ObjectForm для создания объекта
 */
const openObjectForm = (params) => {
  objectFormData.value = {
    mode: params.mode || 'create',
    qrCode: params.qrCode || '',
    initialData: {
      inv_number: params.rowData.inv_number || params.rowData.invNumber || '',
      buh_name: params.rowData.buh_name || params.rowData.buhName || '',
      party_number: params.rowData.party_number || params.rowData.partyNumber || '',
      sklad: params.rowData.sklad || '',
      zavod: params.rowData.zavod || '',
      sn: params.rowData.sn || ''
    }
  }
  showObjectForm.value = true
}

/**
 * Обработчик сохранения ObjectForm
 */
const handleObjectFormSave = (result) => {
  console.log('ObjectForm сохранён:', result)
  showObjectForm.value = false
  
  // Обновляем ведомость после создания объекта
  reload()
}

/**
 * Обработчик отмены ObjectForm
 */
const handleObjectFormCancel = () => {
  console.log('ObjectForm отменён')
  showObjectForm.value = false
}
</script>

<style scoped>
@import './StatementPage.css';
</style>