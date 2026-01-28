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

      <!-- Модалка ObjectForm -->
      <ObjectFormModal
        v-if="statementsLength > 0"
        :is-open="objectFormIsOpen"
        :mode="objectFormMode"
        :initial-data="objectFormInitialData"
        :qr-code="objectFormQrCode"
        @save="objectFormManager.handleObjectFormSave"
        @cancel="objectFormManager.handleObjectFormCancel"
      />

      <!-- Таблица -->
      <StatementTable 
        v-if="statementsLength > 0"
        :statements="tableStatements"
        :columns="columns"
        :get-row-group="getRowGroup"
        :active-filters="activeFiltersValue"
        :has-party-or-quantity="hasPartyOrQuantity"
        @filter-click="handleFilterClick"
        @ignore-change="ignoreManager.handleIgnoreChange"
        @qr-scan="qrScannerManager.handleQrScan"
      />
      <div v-else class="empty">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import FilterModal from './components/FilterModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'

// Композиции
import { useStatementData } from './composables/useStatementData'
import { useStatementColumns } from './composables/useStatementColumns'
import { useStatementProcessing } from './composables/useStatementProcessing'
import { useSimpleFiltersManager } from './composables/useFiltersManager'
import { useIgnoreManager } from './composables/useIgnoreManager'
import { useObjectFormManager } from './composables/useObjectFormManager'
import { useQrScannerManager } from './composables/useQrScannerManager'

const route = useRoute()
const router = useRouter()
const attachmentId = route.params.id

console.log('[STATEMENT-PAGE] Инициализация для attachmentId:', attachmentId)

// === ДАННЫЕ ===
const { loading, error, statements, reload, getRowGroup } = useStatementData(attachmentId)
const { processedStatements, hasPartyOrQuantity } = useStatementProcessing(statements)
const { columns } = useStatementColumns()

// === ПРОСТОЙ ФИЛЬТР ===
const {
  showFilterModal,
  modalTitle,
  filterOptions,
  currentFilterValues,
  isLoadingOptions,
  activeFilters,
  hasActiveFilters,
  filteredStatements,
  openFilterModal,
  closeFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters
} = useSimpleFiltersManager(attachmentId, processedStatements)

// === МЕНЕДЖЕРЫ ===
const objectFormManager = useObjectFormManager(reload)
const qrScannerManager = useQrScannerManager(objectFormManager.openObjectForm)
const ignoreManager = useIgnoreManager(attachmentId, reload)

// === COMPUTED-ОБЕРТКИ ДЛЯ ШАБЛОНА ===
// Фильтры
const filterModalIsOpen = computed(() => showFilterModal.value)
const filterModalTitle = computed(() => modalTitle.value)
const filterModalOptions = computed(() => filterOptions.value)
const filterModalSelectedValues = computed(() => currentFilterValues.value)
const filterModalIsLoading = computed(() => isLoadingOptions.value)
const activeFiltersValue = computed(() => activeFilters.value)

// ObjectForm
const objectFormIsOpen = computed(() => objectFormManager.showObjectForm.value)
const objectFormMode = computed(() => objectFormManager.objectFormData.value.mode)
const objectFormInitialData = computed(() => objectFormManager.objectFormData.value.initialData)
const objectFormQrCode = computed(() => objectFormManager.objectFormData.value.qrCode)

// Данные
const statementsLength = computed(() => statements.value?.length || 0)
const tableStatements = computed(() => filteredStatements.value)
const statementTitle = computed(() => {
  if (!statements.value?.length) return ''
  const firstRow = statements.value[0]
  return `${firstRow.doc_type} ${firstRow.sklad}`
})

// === МЕТОДЫ ===
const handleBack = () => {
  console.log('[STATEMENT-PAGE] Кнопка "Назад" нажата')
  resetAllFilters()
  router.push('/')
}

const handleFilterClick = (columnId) => {
  console.log('[STATEMENT-PAGE] Клик по фильтру для колонки:', columnId)
  openFilterModal(columnId)
}
</script>

<style scoped>
@import './StatementPage.css';
</style>