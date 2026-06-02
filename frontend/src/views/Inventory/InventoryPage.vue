<template>
  <div class="h-screen flex flex-col p-5 bg-gray-50 overflow-hidden">

    <!-- Хедер убрал для экономии места-->

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

      <!-- Модалка детализации группы -->
      <InvListModal
        :is-open="invListIsOpen"
        :inv-number="selectedItem.invNumber"
        :party-number="selectedItem.partyNumber"
        :zavod="selectedItem.zavod"
        :sklad="selectedItem.sklad"
        :id-book="bookId"
        @close="handleInvListClose"
        @saved="reload"
      />

      <!-- Таблица -->

      <InventoryBookTable 
        :key="JSON.stringify(activeFiltersForTable)"
        :items="filteredItems"
        :get-row-class="getRowClass"
        :active-filters="activeFiltersForTable"
        @filter-click="handleFilterClick"
        @actual-change="actualManager.handleActualChange"
        @row-click="handleRowClick"
      />
    </div>

    <!-- Футер: назад + сканер + сброс фильтров -->
    <footer class="flex-shrink-0 bg-white border-t border-gray-200 p-3">
      <div class="flex items-center justify-between gap-3">
        <!-- Левая группа: назад (фиксированная ширина) -->
        <div class="w-[100px]">
          <button 
            class="border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition whitespace-nowrap w-full"
            @click="goBack"
          >
            ← Назад
          </button>
        </div>

        <!-- Центр: сканер (центрируется абсолютно) -->
        <div class="absolute left-1/2 transform -translate-x-1/2">
          <QrScannerButton
            size="medium"
            @scan="handleQrScan"
            @error="handleScanError"
          />
        </div>

        <!-- Правая группа: сброс фильтров (фиксированная ширина, текст с переносом) -->
        <div class="w-[120px] flex justify-end">
          <button 
            v-if="hasActiveFilters" 
            @click="resetAllFilters"
            class="border border-amber-400 bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-amber-100 transition text-center"
            title="Сбросить все фильтры"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import InvListModal from '@/views/Inventory/components/InvListModal.vue'
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

// === СОСТОЯНИЕ ДЛЯ OBJECT VIEW ===
const invListIsOpen = ref(false)
const selectedItem = ref({
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
  
  selectedItem.value = {
    invNumber: groupParams.invNumber,
    partyNumber: groupParams.partyNumber,
    zavod: groupParams.zavod,
    sklad: groupParams.sklad
  }
  
  invListIsOpen.value = true
}

const handleInvListClose = () => {
  invListIsOpen.value = false
  
  setTimeout(() => {
    selectedItem.value = {
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

</script>