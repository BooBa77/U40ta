<template>
  <div class="inventory-page">
    <!-- Хедер -->
    <header class="inventory-header">
      <button class="back-button" @click="goBack">← Назад</button>
      <h1 class="inventory-title">{{ book?.name || 'Загрузка...' }}</h1>
      <button
        v-if="hasActiveFilters"
        class="reset-filters-btn"
        @click="resetAllFilters"
      >Сбросить фильтры</button>
      <div v-else class="header-spacer"></div>
    </header>

    <!-- Основной контент -->
    <main class="inventory-main">
      <!-- Загрузка -->
      <div v-if="loading" class="page-state loading">Загрузка книги...</div>

      <!-- Ошибка -->
      <div v-else-if="error" class="page-state error">
        {{ error }}
        <button @click="reload">Повторить</button>
      </div>

      <!-- Пусто -->
      <div v-else-if="groupedItems.length === 0" class="page-state empty">
        В книге нет строк
      </div>

      <!-- Таблица -->
      <template v-else>
        <!-- Модалка фильтра -->
        <FilterModal
          v-if="filterModalIsOpen"
          :is-open="filterModalIsOpen"
          :title="filterModalTitle"
          :options="filterModalOptions"
          :selected-values="filterModalSelectedValues"
          :is-loading="filterModalIsLoading"
          @close="closeFilterModal"
          @apply="applyFilter"
          @reset="resetCurrentFilter"
        />

        <!-- Модалка детализации группы -->
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
          :items="filteredItems"
          :columns="columns"
          :get-row-class="getRowClass"
          :active-filters="activeFilters"
          @filter-click="handleFilterClick"
          @ignore-change="handleIgnoreChange"
          @row-click="handleRowClick"
        />
      </template>
    </main>

    <!-- Футер -->
    <footer class="inventory-footer">
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
import FilterModal from '@/views/Statement/components/FilterModal.vue'
import ObjectViewModal from '@/views/Statement/components/ObjectViewModal.vue'
import InventoryBookTable from './components/InventoryBookTable.vue'
import { inventoryBookService } from '@/services/inventory-book.service'
import { useSSE } from '@/composables/useSSE'
import { useInventoryBookData } from './composables/useInventoryBookData'
import { useInventoryBookColumns } from './composables/useInventoryBookColumns'
import { useSimpleFiltersManager } from '@/views/Statement/composables/useFiltersManager'

const router = useRouter()
const route = useRoute()
const bookId = Number(route.params.id)

// Данные книги
const book = ref(null)
const { loading, error, groupedItems, reload } = useInventoryBookData(bookId)
const { columns, getRowClass } = useInventoryBookColumns()

// Фильтры — используем тот же менеджер, что и в StatementPage
const {
  showFilterModal,
  modalTitle,
  filterOptions,
  currentFilterValues,
  isLoadingOptions,
  activeFilters,
  hasActiveFilters,
  filteredStatements: filteredItems,
  openFilterModal,
  closeFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters
} = useSimpleFiltersManager(bookId, groupedItems)

// Адаптеры для фильтра
const filterModalIsOpen = computed(() => showFilterModal.value)
const filterModalTitle = computed(() => modalTitle.value)
const filterModalOptions = computed(() => filterOptions.value)
const filterModalSelectedValues = computed(() => currentFilterValues.value)
const filterModalIsLoading = computed(() => isLoadingOptions.value)
const activeFiltersValue = computed(() => activeFilters.value)

// Модалка детализации
const objectViewIsOpen = ref(false)
const selectedGroup = ref({
  invNumber: '',
  partyNumber: null,
  zavod: 0,
  sklad: ''
})

// Загрузка книги
onMounted(async () => {
  try {
    book.value = await inventoryBookService.getBook(bookId)
  } catch (err) {
    console.error('Ошибка загрузки книги:', err)
    router.push('/')
  }
})

// SSE — слушаем изменения книги
useSSE((data) => {
  if (data.type === 'inventory-book-changed' && data.data?.bookId === bookId) {
    inventoryBookService.getBook(bookId).then(b => { book.value = b }).catch(() => {})
  }
})

// Навигация
const goBack = () => {
  resetAllFilters()
  router.push('/')
}

// Клик по строке
const handleRowClick = (groupParams) => {
  selectedGroup.value = groupParams
  objectViewIsOpen.value = true
}

const handleObjectViewClose = () => {
  objectViewIsOpen.value = false
}

// Фильтры
const handleFilterClick = (columnId) => {
  openFilterModal(columnId)
}

// Игнор — будет доработан позже
const handleIgnoreChange = ({ inv, is_ignore }) => {
  console.log('Ignore change:', inv, is_ignore)
}

// QR
const handleQrScan = async (qrCode) => {
  console.log('InventoryPage: QR-скан:', qrCode)
}

const handleScanError = (error) => {
  console.error('InventoryPage: ошибка сканирования:', error)
}
</script>

<style scoped>
@import './InventoryPage.css';
</style>