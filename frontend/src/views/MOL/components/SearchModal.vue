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
          <h3 class="text-lg font-semibold text-gray-900">
            Поиск объектов
            <span v-if="totalCount > 0" class="text-sm font-normal text-gray-400 ml-2">({{ filteredCount }} / {{ totalCount }})</span>
          </h3>
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
          <p class="text-sm">Загрузка объектов...</p>
        </div>

        <!-- Состояние ошибки -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center py-16 text-red-600 gap-4 px-5">
          <p class="text-sm text-center">{{ error }}</p>
          <button
            @click="loadObjects"
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
                  <!-- Колонка с порядковым номером -->
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
                  v-for="(obj, index) in filteredData"
                  :key="obj.id"
                  class="border-b border-gray-100 active:bg-gray-50"
                >
                  <!-- Порядковый номер строки -->
                  <td class="px-1 py-2 text-center text-gray-400 text-xs shrink-0">
                    {{ index + 1 }}
                  </td>                
                  <td
                    v-for="col in visibleColumns"
                    :key="col.id"
                    :class="[
                      'px-2 py-2 text-gray-700 whitespace-nowrap',
                      col.id === columnWithAutoWidth ? 'break-all whitespace-normal' : ''
                    ]"
                  >
                    {{ formatCellValue(obj, col) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Пустое состояние -->
            <div v-else class="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm italic px-5 text-center">
              {{ hasActiveFilters ? 'Нет объектов, соответствующих фильтрам' : 'Нет данных для отображения' }}
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

  <!-- UniversalFilterModal для фильтрации по колонке -->
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
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import { objectService } from '@/services/object.service'
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

/**
 * Все колонки таблицы objects.
 * @typedef {Object} ColumnConfig
 * @property {string} id — ключ поля в объекте
 * @property {string} label — заголовок колонки
 * @property {Function} getValue — извлечение значения из строки
 * @property {string} [width] — фиксированная ширина (CSS-значение)
 * @property {boolean} [filterable] — можно ли фильтровать по колонке
 */

const allColumns = [
  // Экран 1
  { id: 'zavod',        label: 'завод',       getValue: (row) => row.zavod,              width: undefined,  filterable: true,  screen: 0 },
  { id: 'sklad',        label: 'склад',       getValue: (row) => row.sklad,              width: undefined,  filterable: true,  screen: 0 },
  { id: 'invNumber',    label: 'инв. номер',  getValue: (row) => row.invNumber,          width: undefined, filterable: true,  screen: 0 },
  { id: 'partyNumber',  label: 'партия',      getValue: (row) => row.partyNumber,        width: undefined,  filterable: true,  screen: 0 },
  // Экран 2
  { id: 'buhName',      label: 'наименование', getValue: (row) => row.buhName,           width: undefined, filterable: true,  screen: 1 },
  { id: 'sn',           label: 's/n',         getValue: (row) => row.sn,                 width: undefined, filterable: true,  screen: 1 },
  // Экран 3
  { id: 'placeTer',     label: 'тер.',  getValue: (row) => row.placeTer,           width: undefined,  filterable: true,  screen: 2 },
  { id: 'placePos',     label: 'поз.',     getValue: (row) => row.placePos,           width: undefined,  filterable: true,  screen: 2 },
  { id: 'placeCab',     label: 'каб.',     getValue: (row) => row.placeCab,           width: undefined,  filterable: true,  screen: 2 },
  { id: 'placeUser',    label: 'пол-ль', getValue: (row) => row.placeUser,         width: undefined, filterable: true,  screen: 2 },
  // Экран 4
  { id: 'checkedAt',    label: 'проверен',    getValue: (row) => formatDate(row.checkedAt), width: '90px', filterable: false, screen: 3 },
  { id: 'isWrittenOff', label: 'списан',      getValue: (row) => row.isWrittenOff ? 'Да' : 'Нет', width: '70px', filterable: false, screen: 3 },
]

/**
 * Группировка колонок по экранам.
 */
const columnScreens = [
  { id: 0, columns: allColumns.filter(c => c.screen === 0) },
  { id: 1, columns: allColumns.filter(c => c.screen === 1) },
  { id: 2, columns: allColumns.filter(c => c.screen === 2) },
  { id: 3, columns: allColumns.filter(c => c.screen === 3) },
]

/** Колонка с авто-шириной для текущего экрана */
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
const allObjects = ref([])
const currentScreenIndex = ref(0)

// ============================================================================
// ФИЛЬТРЫ (useTableFilter)
// ============================================================================

/**
 * Конфигурация фильтруемых колонок для useTableFilter.
 * Включаем только те, у которых filterable: true.
 */
const filterColumns = allColumns.filter(c => c.filterable)

const {
  filterModalState,
  hasActiveFilters,
  filteredData,
  activeFilters,
  openFilterModal,
  closeFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  hasFilter
} = useTableFilter(allObjects, filterColumns)

// Ключ для localStorage
const FILTERS_STORAGE_KEY = 'mol_search_filters'

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
// ============================================================================

/** Колонки текущего экрана */
const visibleColumns = computed(() => {
  return columnScreens[currentScreenIndex.value]?.columns || []
})

/** Общее количество объектов */
const totalCount = computed(() => allObjects.value.length)

/** Количество после фильтрации */
const filteredCount = computed(() => filteredData.value.length)

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

/**
 * Загрузка объектов с учётом онлайн/офлайн режима.
 */
const loadObjects = async () => {
  isLoading.value = true
  error.value = null

  try {
    const isFlightMode = objectService.isFlightMode()

    if (isFlightMode) {
      // Офлайн: собираем все объекты из кэша по всем комбинациям zavod+sklad
      const combinations = await objectService.getSkladCombinations()
      const allResults = []

      for (const { zavod, sklad } of combinations) {
        const objects = await objectService.getObjectsBySklad(zavod, sklad)
        allResults.push(...objects)
      }

      allObjects.value = allResults
    } else {
      // Онлайн: получаем user_id из JWT и список доступных складов
      const token = localStorage.getItem('auth_token')
      if (!token) throw new Error('Токен авторизации не найден')

      // Извлекаем user_id из payload JWT (второй сегмент)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const userId = payload.sub

      if (!userId) throw new Error('Не удалось получить ID пользователя из токена')

      // Получаем список складов МОЛа
      const molResponse = await fetch(`/api/users/me/mol-access`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!molResponse.ok) throw new Error(`Ошибка получения списка складов: HTTP ${molResponse.status}`)

      const molData = await molResponse.json()
      const sklads = molData.sklads || molData || []

      // Загружаем объекты по каждому складу
      const allResults = []
      for (const { zavod, sklad } of sklads) {
        const objects = await objectService.getObjectsBySklad(zavod, sklad)
        allResults.push(...objects)
      }

      allObjects.value = allResults
    }

    // Восстанавливаем фильтры из localStorage
    restoreFilters()
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных'
    console.error('[SearchModal]', e)
  } finally {
    isLoading.value = false
  }
}

// ============================================================================
// ФОРМАТИРОВАНИЕ
// ============================================================================

/**
 * Форматирует значение ячейки для отображения.
 * @param {Object} obj — строка объекта
 * @param {Object} col — конфигурация колонки
 * @returns {string}
 */
const formatCellValue = (obj, col) => {
  const value = col.getValue(obj)
  return value ?? '—'
}

/**
 * Форматирует дату в краткий вид.
 * @param {string|Date|null} date
 * @returns {string}
 */
const formatDate = (date) => {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ============================================================================
// УПРАВЛЕНИЕ ЭКРАНАМИ КОЛОНОК
// ============================================================================

const prevScreen = () => {
  if (currentScreenIndex.value > 0) {
    currentScreenIndex.value--
  }
}

const nextScreen = () => {
  if (currentScreenIndex.value < columnScreens.length - 1) {
    currentScreenIndex.value++
  }
}

// ============================================================================
// СОХРАНЕНИЕ / ВОССТАНОВЛЕНИЕ ФИЛЬТРОВ
// ============================================================================

/**
 * Сохраняет активные фильтры в localStorage.
 */
const saveFilters = () => {
  try {
    const serializable = {}
    for (const [key, values] of Object.entries(activeFilters.value)) {
      if (values && values.length > 0) {
        serializable[key] = [...values]
      }
    }
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(serializable))
  } catch (e) {
    console.warn('[SearchModal] Не удалось сохранить фильтры:', e)
  }
}

/**
 * Восстанавливает фильтры из localStorage.
 */
const restoreFilters = () => {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return

    const saved = JSON.parse(raw)
    for (const [key, values] of Object.entries(saved)) {
      if (Array.isArray(values) && values.length > 0) {
        activeFilters.value[key] = [...values]
      }
    }
  } catch (e) {
    console.warn('[SearchModal] Не удалось восстановить фильтры:', e)
  }
}

// ============================================================================
// ОБРАБОТЧИКИ
// ============================================================================

/**
 * Открытие модалки фильтра по клику на заголовок колонки.
 * @param {string} columnId — ID колонки
 */
const handleFilterClick = (columnId) => {
  openFilterModal(columnId)
}

/**
 * Обёртка над applyFilter с сохранением в localStorage.
 * @param {Array} selectedValues — выбранные значения
 */
const handleApplyFilter = (selectedValues) => {
  applyFilter(selectedValues)
  saveFilters()
}

/**
 * Сброс всех фильтров.
 */
const handleResetAllFilters = () => {
  resetAllFilters()
  saveFilters()
}

/**
 * Закрытие модалки поиска.
 */
const handleClose = () => {
  emit('close')
}

/**
 * Закрытие по клику на оверлей.
 */
const handleOverlayClick = () => {
  emit('close')
}

// ============================================================================
// НАБЛЮДЕНИЕ ЗА ОТКРЫТИЕМ
// ============================================================================

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    currentScreenIndex.value = 0
    loadObjects()
  }
})

// ============================================================================
// ОЧИСТКА
// ============================================================================

onBeforeUnmount(() => {
  // Не сбрасываем фильтры — они сохранены в localStorage
})
</script>

<style scoped>
/* Анимация модалки */
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