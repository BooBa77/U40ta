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
        :is-open="objectFormIsOpen"
        :object-id="objectFormObjectId"
        :initial-data="objectFormInitialData"
        :initial-qr-code="objectFormQrCode"
        @save="handleObjectFormSave"
        @cancel="handleObjectFormCancel"
      />

      <!-- НОВАЯ МОДАЛКА: LocViewModal -->
      <LocViewModal
        :is-open="locViewIsOpen"
        :inv-number="selectedGroup.invNumber"
        :party-number="selectedGroup.partyNumber"
        :zavod="selectedGroup.zavod"
        :sklad="selectedGroup.sklad"
        @close="handleLocViewClose"
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
        @qr-scan="openObjectFormFromRowData"
        @row-click="handleRowClick"
      />
      <div v-else class="empty">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import FilterModal from './components/FilterModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import LocViewModal from './components/LocViewModal.vue'

// Композиции
import { useStatementData } from './composables/useStatementData'
import { useStatementColumns } from './composables/useStatementColumns'
import { useStatementProcessing } from './composables/useStatementProcessing'
import { useSimpleFiltersManager } from './composables/useFiltersManager'
import { useIgnoreManager } from './composables/useIgnoreManager'
import { statementService } from './services/statement.service'

const route = useRoute()
const router = useRouter()
const attachmentId = route.params.id

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

// === СОСТОЯНИЕ OBJECT FORM ===
const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormStatementId = ref(null) // id записи в ведомости
const objectFormInitialData = ref({})
const objectFormQrCode = ref(null)

// === НОВОЕ СОСТОЯНИЕ ДЛЯ LOC VIEW ===
const locViewIsOpen = ref(false)
const selectedGroup = ref({
  invNumber: '',
  partyNumber: null,
  zavod: '',
  sklad: ''
})

// === COMPUTED-ОБЕРТКИ ===
const filterModalIsOpen = computed(() => showFilterModal.value)
const filterModalTitle = computed(() => modalTitle.value)
const filterModalOptions = computed(() => filterOptions.value)
const filterModalSelectedValues = computed(() => currentFilterValues.value)
const filterModalIsLoading = computed(() => isLoadingOptions.value)
const activeFiltersValue = computed(() => activeFilters.value)

const statementsLength = computed(() => statements.value?.length || 0)
const tableStatements = computed(() => filteredStatements.value)
const statementTitle = computed(() => {
  if (!statements.value?.length) return ''
  const firstRow = statements.value[0]
  return `${firstRow.doc_type} ${firstRow.sklad}`
})

// === ОБРАБОТЧИК КЛИКА ПО СТРОКЕ ТАБЛИЦЫ ===
const handleRowClick = (groupParams) => {
  console.log('[StatementPage] Клик по строке, открываем LocViewModal с параметрами:', groupParams)
  
  // Сохраняем параметры группы
  selectedGroup.value = {
    invNumber: groupParams.invNumber,
    partyNumber: groupParams.partyNumber,
    zavod: groupParams.zavod,
    sklad: groupParams.sklad
  }
  
  // Открываем модалку
  locViewIsOpen.value = true
}

/**
 * Закрытие LocViewModal
 */
const handleLocViewClose = () => {
  console.log('[StatementPage] Закрытие LocViewModal')
  locViewIsOpen.value = false
  
  // Сбрасываем выбранную группу (с задержкой, чтобы не мешать анимации)
  setTimeout(() => {
    selectedGroup.value = {
      invNumber: '',
      partyNumber: null,
      zavod: '',
      sklad: ''
    }
  }, 300)
}

// === ОБРАБОТЧИК ДЛЯ ОТКРЫТИЯ ФОРМЫ ИЗ ТАБЛИЦЫ ===
const openObjectFormFromRowData = ({ scannedData, rowData }) => {
  console.log('[STATEMENT-PAGE] Открытие формы для строки ведомости:', rowData)
  console.log('[STATEMENT-PAGE] Отсканированный код:', scannedData)
  
  objectFormStatementId.value = rowData.id || null
  objectFormObjectId.value = null
  objectFormInitialData.value = rowData
  objectFormQrCode.value = scannedData
  
  objectFormIsOpen.value = true
}

// === ОБРАБОТЧИКИ OBJECT FORM ===
const handleObjectFormSave = async (result) => {
  console.log('[STATEMENT-PAGE] Результат сохранения объекта:', result, objectFormStatementId.value)
  
  // Закрываем модалку
  objectFormIsOpen.value = false
  resetObjectFormState()

  console.log('Модалка закрыта', objectFormStatementId.value)

  // Если объект изменился
  if (result.wasCreated) {
    // Обновляем have_object для записи ведомости
    if (objectFormStatementId.value) {
      try {
        console.log('[STATEMENT-PAGE] Устанавливаем have_object=true для записи:', {
          statementId: objectFormStatementId.value
        })
        
        await statementService.updateStatementHaveObject(
          objectFormStatementId.value,
          true
        )
        
      } catch (error) {
        console.error('[STATEMENT-PAGE] Ошибка обновления ведомости:', error)
      }
    }
    
    // Перезагружаем ведомость для отображения изменений
    reload()
  }
}

const handleObjectFormCancel = () => {
  console.log('[STATEMENT-PAGE] Отмена создания объекта')
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
  console.log('[STATEMENT-PAGE] Кнопка "Назад" нажата')
  resetAllFilters()
  router.push('/')
}

const handleFilterClick = (columnId) => {
  console.log('[STATEMENT-PAGE] Клик по фильтру для колонки:', columnId)
  openFilterModal(columnId)
}

// === МЕНЕДЖЕРЫ ===
const ignoreManager = useIgnoreManager(attachmentId, reload)

</script>

<style scoped>
@import './StatementPage.css';
</style>