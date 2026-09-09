<template>
  <Transition name="modal">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      @click.self="handleOverlayClick"
    >
      <div
        class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style="width: 95vw; max-width: 600px; max-height: 90vh"
      >
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <!-- Чекбокс отображения неактуальных -->
          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              v-model="showInactive"
              type="checkbox"
              class="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            Не актуальные
          </label>
          <div class="flex items-center gap-2">
            <button
              v-if="hasActiveFilters"
              @click="handleResetAllFilters"
              class="border border-amber-400 bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg text-xs
                     active:bg-amber-100 transition whitespace-nowrap"
              title="Сбросить все фильтры"
            >
              Сбросить
            </button>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 text-2xl
                     active:bg-gray-100 active:text-gray-900"
              @click="handleClose"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Состояние загрузки -->
        <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
          <div class="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p class="text-sm">Загрузка строк...</p>
        </div>

        <!-- Состояние ошибки -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center py-16 text-red-600 gap-4 px-5">
          <p class="text-sm text-center">{{ error }}</p>
          <button
            @click="loadItems"
            class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium active:bg-red-600"
          >
            Повторить
          </button>
        </div>

        <!-- Основной контент -->
        <template v-else>
          <!-- Таблица -->
          <div class="overflow-x-auto flex-1 min-h-0">
            <table v-if="filteredData.length > 0" class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th class="bg-gray-50 px-1 py-2.5 text-center font-semibold text-gray-800 border-b-2 border-gray-200 w-[36px] shrink-0">
                    №
                  </th>
                  <th
                    v-for="col in visibleColumns"
                    :key="col.id"
                    :style="{ width: col.width || 'auto' }"
                    :class="[
                      'bg-gray-50 px-2 py-2.5 text-left font-semibold text-gray-800 border-b-2 border-gray-200 whitespace-nowrap',
                      col.filterable ? 'cursor-pointer active:bg-gray-200 select-none' : '',
                      hasFilter(col.id) ? 'text-blue-600' : ''
                    ]"
                    @click="col.filterable ? handleFilterClick(col.id) : undefined"
                  >
                    {{ col.label }}
                    <span v-if="hasFilter(col.id)" class="ml-1 text-blue-500">▼</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in filteredData"
                  :key="item.id"
                  :class="[
                    'border-b border-gray-100 active:bg-gray-50',
                    item.idObject > 0 ? 'cursor-pointer' : 'cursor-default'
                  ]"
                  @click="item.idObject > 0 ? handleRowClick(item) : undefined"
                >
                  <td class="px-1 py-2 text-center text-gray-400 text-xs shrink-0">
                    {{ index + 1 }}
                  </td>
                  <td
                    v-for="col in visibleColumns"
                    :key="col.id"
                    :class="[
                      'px-2 py-2 whitespace-nowrap',
                      getCellClass(item, col.id),
                      col.id === columnWithAutoWidth ? 'break-all whitespace-normal' : ''
                    ]"
                  >
                    {{ formatCellValue(item, col) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Пустое состояние -->
            <div v-else class="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm italic px-5 text-center">
              {{ hasActiveFilters || !showInactive ? 'Нет строк, соответствующих условиям' : 'Нет данных для отображения' }}
            </div>
          </div>

          <!-- Переключение экранов колонок -->
          <div v-if="!isLoading && !error" class="flex items-center justify-between px-5 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
            <button
              :disabled="currentScreenIndex === 0"
              :class="[
                'px-3 py-1.5 rounded-md text-xs font-medium transition',
                currentScreenIndex === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 active:bg-gray-300'
              ]"
              @click="prevScreen"
            >
              ← Влево
            </button>
            <span class="text-xs text-gray-500">{{ currentScreenIndex + 1 }} / {{ columnScreens.length }}</span>
            <button
              :disabled="currentScreenIndex === columnScreens.length - 1"
              :class="[
                'px-3 py-1.5 rounded-md text-xs font-medium transition',
                currentScreenIndex === columnScreens.length - 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 active:bg-gray-300'
              ]"
              @click="nextScreen"
            >
              Вправо →
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>

  <!-- UniversalFilterModal для фильтрации -->
  <UniversalFilterModal
    :is-open="filterModalState.isOpen"
    :title="filterModalState.title"
    :options="filterModalState.options"
    :selected-values="filterModalState.selectedValues"
    :is-loading="filterModalState.isLoading"
    @apply="handleApplyFilter"
    @close="closeFilterModal"
    @reset="resetCurrentFilter"
  />

  <!-- Модалка ObjectForm -->
  <ObjectFormModal
    :is-open="objectFormIsOpen"
    :object-id="objectFormObjectId"
    :initial-data="objectFormInitialData"
    @save="handleObjectFormSave"
    @cancel="handleObjectFormCancel"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import { molService } from '@/services/mol.service'
import { useTableFilter } from '@/composables/useTableFilter'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close'])

// ============================================================================
// КОНФИГУРАЦИЯ ЭКРАНОВ КОЛОНОК
// ============================================================================

const allColumns = [
  { id: 'invNumber',    label: 'Инв. номер',  getValue: (row) => row.invNumber,          width: undefined, filterable: true,  screen: 0 },
  { id: 'partyNumber',  label: 'Партия',      getValue: (row) => row.partyNumber,        width: '85px',  filterable: true,  screen: 0 },
  { id: 'buhName',      label: 'Наименование', getValue: (row) => row.buhName,           width: undefined, filterable: true,  screen: 0 },
  { id: 'placeTer',     label: 'Территория',  getValue: (row) => row.placeTer || '—',    width: '60px',  filterable: true,  screen: 1 },
  { id: 'placePos',     label: 'Позиция',     getValue: (row) => row.placePos || '—',    width: '60px',  filterable: true,  screen: 1 },
  { id: 'placeCab',     label: 'Кабинет',     getValue: (row) => row.placeCab || '—',    width: '55px',  filterable: true,  screen: 1 },
  { id: 'placeUser',    label: 'Пользователь', getValue: (row) => row.placeUser || '—',  width: undefined, filterable: true,  screen: 1 },
  { id: 'isOk',         label: 'Подтверждено', getValue: (row) => (row.isOkManual || row.isOkAuto) ? 'Да' : 'Нет', width: '70px', filterable: false, screen: 2 },
  { id: 'dateOkChecked', label: 'Дата',       getValue: (row) => formatDate(row.dateOkChecked), width: '90px', filterable: false, screen: 2 },
  { id: 'rem',          label: 'Комментарий', getValue: (row) => row.rem || '—',         width: undefined, filterable: false, screen: 3 },
]

const columnScreens = [
  { id: 0, columns: allColumns.filter(c => c.screen === 0) },
  { id: 1, columns: allColumns.filter(c => c.screen === 1) },
  { id: 2, columns: allColumns.filter(c => c.screen === 2) },
  { id: 3, columns: allColumns.filter(c => c.screen === 3) },
]

const columnWithAutoWidth = computed(() => {
  const screen = columnScreens[currentScreenIndex.value]
  if (!screen) return null
  const autoCol = screen.columns.find(c => c.width === undefined)
  return autoCol?.id || null
})

// ============================================================================
// СОСТОЯНИЕ
// ============================================================================

const isLoading = ref(false)
const error = ref(null)
const allItems = ref([])
const currentScreenIndex = ref(0)
const showInactive = ref(false)

// ============================================================================
// СОСТОЯНИЕ OBJECT FORM
// ============================================================================

const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormInitialData = ref({})

// ============================================================================
// ФИЛЬТРЫ
// ============================================================================

const filterColumns = allColumns.filter(c => c.filterable)

const {
  filterModalState,
  hasActiveFilters,
  filteredData: baseFilteredData,
  activeFilters,
  openFilterModal,
  closeFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  hasFilter
} = useTableFilter(allItems, filterColumns)

const filteredData = computed(() => {
  if (showInactive.value) {
    return baseFilteredData.value
  }
  return baseFilteredData.value.filter(item => item.isActual)
})

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
// ============================================================================

const visibleColumns = computed(() => {
  return columnScreens[currentScreenIndex.value]?.columns || []
})

const totalCount = computed(() => allItems.value.length)
const filteredCount = computed(() => filteredData.value.length)

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

const loadItems = async () => {
  isLoading.value = true
  error.value = null

  try {
    allItems.value = await molService.getMolInventoryItems()
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных'
    console.error('[MolInventoryModal]', e)
  } finally {
    isLoading.value = false
  }
}

// ============================================================================
// ФОРМАТИРОВАНИЕ
// ============================================================================

const formatCellValue = (item, col) => {
  const value = col.getValue(item)
  return value ?? '—'
}

const formatDate = (dateString) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const getCellClass = (item, colId) => {
  // Цветовая индикация
  if (colId === 'invNumber') {
    if (!item.isActual) return 'text-gray-400 line-through'
    if (item.isOkManual || item.isOkAuto) return 'text-green-600 font-medium'
    if (!item.idObject) return 'text-red-600 font-medium'
    return 'text-gray-700'
  }
  return 'text-gray-700'
}

// ============================================================================
// УПРАВЛЕНИЕ ЭКРАНАМИ
// ============================================================================

const prevScreen = () => {
  if (currentScreenIndex.value > 0) currentScreenIndex.value--
}

const nextScreen = () => {
  if (currentScreenIndex.value < columnScreens.length - 1) currentScreenIndex.value++
}

// ============================================================================
// ОБРАБОТЧИКИ ФИЛЬТРОВ
// ============================================================================

const handleFilterClick = (columnId) => {
  openFilterModal(columnId)
}

const handleApplyFilter = (selectedValues) => {
  applyFilter(selectedValues)
}

const handleResetAllFilters = () => {
  resetAllFilters()
}

// ============================================================================
// ОБРАБОТЧИКИ OBJECT FORM
// ============================================================================

const handleRowClick = (item) => {
  objectFormObjectId.value = item.idObject
  objectFormInitialData.value = {}
  objectFormIsOpen.value = true
}

const handleObjectFormSave = (result) => {
  objectFormIsOpen.value = false
  resetObjectFormState()
  if (result.wasCreated) {
    loadItems()
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

// ============================================================================
// ОБРАБОТЧИКИ МОДАЛКИ
// ============================================================================

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = () => {
  emit('close')
}

// ============================================================================
// НАБЛЮДЕНИЕ ЗА ОТКРЫТИЕМ
// ============================================================================

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    currentScreenIndex.value = 0
    loadItems()
  } else {
    allItems.value = []
    error.value = null
  }
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-5px);
}
</style>