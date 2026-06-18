<template>
  <div class="h-screen flex flex-col p-5 bg-gray-50 overflow-hidden">

    <!-- Шапка -->
    <header class="flex items-center justify-between gap-3 p-4 border-b border-gray-200 bg-white flex-shrink-0">
      <button 
        class="border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition whitespace-nowrap"
        @click="handleBack"
      >
        ← Назад
      </button>
      
      <h1 class="text-lg font-semibold text-gray-800 flex-1 text-center truncate min-w-0">
        {{ statementTitle }}
      </h1>
      
      <button 
        v-if="hasActiveFilters" 
        @click="resetAllFilters"
        class="border border-amber-400 bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-amber-100 transition whitespace-nowrap"
        title="Сбросить все фильтры"
      >
        Сбросить фильтры
      </button>
    </header>

    <!-- Загрузка -->
    <div v-if="loading" class="flex-1 flex flex-col justify-center items-center text-blue-500 text-lg">
      Загрузка ведомости...
    </div>
    
    <!-- Ошибка -->
    <div v-else-if="error" class="flex-1 flex flex-col justify-center items-center text-red-600 text-lg gap-4">
      {{ error }}
      <button 
        @click="reload"
        class="px-5 py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
      >
        Повторить
      </button>
    </div>
    
    <!-- Данные -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Универсальная модалка фильтра -->
      <UniversalFilterModal
        :is-open="filterModalState.isOpen"
        :title="filterModalState.title"
        :options="filterModalState.options"
        :selected-values="filterModalState.selectedValues"
        :is-loading="filterModalState.isLoading"
        @apply="applyFilter"
        @close="closeFilterModal"
        @reset="resetCurrentFilter"
      />

      <!-- Модалка ObjectForm -->
      <ObjectFormModal
        :is-open="objectFormIsOpen"
        :object-id="objectFormObjectId"
        :initial-data="objectFormInitialData"
        :initial-qr-code="objectFormQrCode"
        @save="handleObjectFormSave"
        @cancel="handleObjectFormCancel"
      />

      <!-- Модалка InvListModal -->
      <InvListModal
        :is-open="invListIsOpen"
        :inv-number="selectedItem.invNumber"
        :party-number="selectedItem.partyNumber"
        :zavod="selectedItem.zavod"
        :sklad="selectedItem.sklad"
        :is-excess-context="selectedItem.isExcess || false"
        @close="handleInvListClose"
      />

      <!-- Таблица -->
      <StatementTable 
        :key="JSON.stringify(activeFiltersForTable)"
        v-if="statementsLength > 0"
        :statements="tableStatements"
        :get-row-group="getAggregatedRowGroup"
        :active-filters="activeFiltersForTable"
        :has-party-or-quantity="hasPartyOrQuantity"
        @filter-click="handleFilterClick"
        @actual-change="actualManager.handleActualChange"
        @qr-scan="openObjectFormFromRowData"
        @row-click="handleRowClick"
      />
      <div v-else class="flex-1 flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-lg text-gray-400 text-lg">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import InvListModal from './components/InvListModal.vue'

// Композаблы
import { useStatementData } from './composables/useStatementData'
import { useStatementAggregation } from './composables/table/useStatementAggregation'
import { useTableFilter } from '@/composables/useTableFilter'
import { useActualManager } from './composables/table/useActualManager'
import { statementService } from '@/services/statement.service'

const route = useRoute()
const router = useRouter()

/**
 * Дата получения ведомости из параметра маршрута.
 * В URL: /statement/2026-01-15T10:30:00.000Z
 */
const receivedAt = decodeURIComponent(route.params.receivedAt)

// === ДАННЫЕ ===
const { loading, error, statements, reload } = useStatementData(receivedAt)
const { aggregatedStatements, hasPartyOrQuantity, getRowGroup: getAggregatedRowGroup } = useStatementAggregation(statements)

// === КОНФИГУРАЦИЯ ФИЛЬТРОВ ===
const filterColumns = [
  {
    id: 'inv_number',
    title: 'Фильтр по инвентарному номеру',
    getValue: (row) => row.invNumber
  },
  {
    id: 'buh_name',
    title: 'Фильтр по наименованию',
    getValue: (row) => row.buhName
  }
]

// === ФИЛЬТР ===
const {
  filterModalState,
  hasActiveFilters,
  filteredData: tableFilteredData,
  openFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  activeFilters
} = useTableFilter(aggregatedStatements, filterColumns)

// === СОСТОЯНИЕ OBJECT FORM ===
const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormStatementId = ref(null)
const objectFormInitialData = ref({})
const objectFormQrCode = ref(null)

// === СОСТОЯНИЕ ДЛЯ OBJECT VIEW ===
const invListIsOpen = ref(false)
const selectedItem = ref({
  invNumber: '',
  partyNumber: null,
  zavod: '',
  sklad: ''
})

// === COMPUTED-ОБЕРТКИ ===
const statementsLength = computed(() => tableStatements.value?.length || 0)
const tableStatements = computed(() => tableFilteredData.value)

/**
 * Преобразуем activeFilters в формат, который ожидает таблица.
 */
const activeFiltersForTable = computed(() => {
  const result = {}
  if (activeFilters.value.inv_number) {
    result.inv_number = activeFilters.value.inv_number
  }
  if (activeFilters.value.buh_name) {
    result.buh_name = activeFilters.value.buh_name
  }
  return result
})

/**
 * Заголовок ведомости.
 * Берём описание из первой строки.
 */
const statementTitle = computed(() => {
  if (!statements.value?.length) return ''
  return statements.value[0].description || ''
})

// === ОБРАБОТЧИК КЛИКА ПО СТРОКЕ ТАБЛИЦЫ ===
const handleRowClick = (groupParams) => {
  selectedItem.value = {
    invNumber: groupParams.invNumber,
    partyNumber: groupParams.partyNumber,
    zavod: groupParams.zavod,
    sklad: groupParams.sklad,
    isExcess: groupParams.isExcess || false
  }
  
  invListIsOpen.value = true
}

const handleInvListClose = () => {
  invListIsOpen.value = false
  
  setTimeout(() => {
    selectedItem.value = {
      invNumber: '',
      partyNumber: null,
      zavod: '',
      sklad: ''
    }
  }, 300)
}

// === ОБРАБОТЧИК ДЛЯ ОТКРЫТИЯ ФОРМЫ ИЗ ТАБЛИЦЫ ===
const openObjectFormFromRowData = ({ scannedData, rowData }) => {
  objectFormStatementId.value = rowData.id || null
  objectFormObjectId.value = null
  objectFormInitialData.value = rowData
  objectFormQrCode.value = scannedData
  
  objectFormIsOpen.value = true
}

// === ОБРАБОТЧИКИ OBJECT FORM ===
const handleObjectFormSave = async (result) => {
  objectFormIsOpen.value = false
  resetObjectFormState()

  if (result.wasCreated) {
    if (objectFormStatementId.value) {
      try {
        await statementService.updateHaveObject(objectFormStatementId.value)
      } catch (error) {
        console.error('[StatementPage] Ошибка обновления ведомости:', error)
      }
    }
    
    reload()
  }
}

const handleObjectFormCancel = () => {
  objectFormIsOpen.value = false
  resetObjectFormState()
}

const resetObjectFormState = () => {
  setTimeout(() => {
    objectFormObjectId.value = null
    objectFormInitialData.value = {}
  }, 300)
}

// === МЕТОДЫ ===
const handleBack = () => {
  resetAllFilters()
  router.push('/')
}

const handleFilterClick = (columnId) => {
  const mapping = {
    'inv_party_combined': 'inv_number',
    'buh_name': 'buh_name'
  }
  openFilterModal(mapping[columnId] || columnId)
}

const closeFilterModal = () => {
  filterModalState.value.isOpen = false
}

// === МЕНЕДЖЕР АКТУАЛЬНОСТИ ===
const actualManager = useActualManager(receivedAt, reload)

</script>