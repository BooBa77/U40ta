<template>
  <div class="h-screen flex flex-col p-5 bg-gray-50 overflow-hidden">

    <!-- Хедер -->
    <header class="flex items-center justify-between gap-3 p-4 border-b border-gray-200 bg-white flex-shrink-0">
      <button 
        class="border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition whitespace-nowrap"
        @click="goBack"
      >
        ← Назад
      </button>
      
      <h1 class="text-lg font-semibold text-gray-800 flex-1 text-center truncate min-w-0">
        {{ bookName }}
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
      Загрузка книги...
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

      <!-- Модалка детализации группы (пока старая, позже заменим на InventoryViewModal) -->
      <ObjectViewModal
        :is-open="objectViewIsOpen"
        :inv-number="selectedGroup.invNumber"
        :party-number="selectedGroup.partyNumber"
        :zavod="selectedGroup.zavod"
        :sklad="selectedGroup.sklad"
        @close="handleObjectViewClose"
      />

      <!-- Таблица -->
      <InventoryBookTable 
        v-if="aggregatedItems.length > 0"
        :items="filteredItems"
        :get-row-class="getRowClass"
        :active-filters="activeFiltersForTable"
        @filter-click="handleFilterClick"
        @actual-change="actualManager.handleActualChange"
        @row-click="handleRowClick"
      />
      <div v-else class="flex-1 flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-lg text-gray-400 text-lg">
        В книге нет данных
      </div>
    </div>

    <!-- Футер с QR-сканером -->
    <footer class="flex-shrink-0 bg-white border-t border-gray-200 p-4 flex justify-center">
      <QrScannerButton
        size="medium"
        @scan="handleQrScan"
        @error="handleScanError"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import ObjectViewModal from '@/views/Statement/components/ObjectViewModal.vue'
import InventoryBookTable from './components/InventoryBookTable.vue'

// Композаблы
import { useInventoryBookData } from './composables/useInventoryBookData'
import { useInventoryAggregation } from './composables/table/useInventoryAggregation'
import { useTableFilter } from '@/composables/useTableFilter'
import { useActualManager } from './composables/table/useActualManager'
import { inventoryBookService } from '@/services/inventory-book.service'

const route = useRoute()
const router = useRouter()
const bookId = Number(route.params.id)

// === ДАННЫЕ ===
const { loading, error, rawItems, reload } = useInventoryBookData(bookId)
const { aggregatedItems, getRowClass } = useInventoryAggregation(rawItems)

// === НАЗВАНИЕ КНИГИ ===
const bookName = ref('Загрузка...')

// === МЕНЕДЖЕР АКТУАЛЬНОСТИ ===
const actualManager = useActualManager(bookId, reload)

onMounted(async () => {
  try {
    const book = await inventoryBookService.getBook(bookId)
    bookName.value = book.name
  } catch (err) {
    console.error('Ошибка загрузки книги:', err)
    bookName.value = 'Ошибка загрузки'
  }
})

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
  filteredData: filteredItems,
  openFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  activeFilters
} = useTableFilter(aggregatedItems, filterColumns)

// === СОСТОЯНИЕ OBJECT FORM ===
const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormInitialData = ref({})
const objectFormQrCode = ref(null)

// === СОСТОЯНИЕ ДЛЯ OBJECT VIEW ===
const objectViewIsOpen = ref(false)
const selectedGroup = ref({
  invNumber: '',
  partyNumber: null,
  zavod: 0,
  sklad: ''
})

// === COMPUTED ===
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

// === ОБРАБОТЧИКИ ===
const goBack = () => {
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

const handleRowClick = (groupParams) => {
  console.log('[InventoryPage] Клик по строке, открываем ObjectViewModal')
  
  selectedGroup.value = {
    invNumber: groupParams.invNumber,
    partyNumber: groupParams.partyNumber,
    zavod: groupParams.zavod,
    sklad: groupParams.sklad
  }
  
  objectViewIsOpen.value = true
}

const handleObjectViewClose = () => {
  objectViewIsOpen.value = false
  
  setTimeout(() => {
    selectedGroup.value = {
      invNumber: '',
      partyNumber: null,
      zavod: 0,
      sklad: ''
    }
  }, 300)
}

// === QR-СКАНИРОВАНИЕ В ФУТЕРЕ ===
const handleQrScan = async (qrCode) => {
  console.log('[InventoryPage] QR-скан в футере:', qrCode)
  // TODO: открыть новую инвентаризационную модалку
}

const handleScanError = (error) => {
  console.error('[InventoryPage] Ошибка сканирования:', error)
}

// === ОБРАБОТЧИКИ OBJECT FORM ===
const handleObjectFormSave = async (result) => {
  console.log('[InventoryPage] Результат сохранения объекта:', result)
  objectFormIsOpen.value = false
  await reload()
}

const handleObjectFormCancel = () => {
  objectFormIsOpen.value = false
}
</script>