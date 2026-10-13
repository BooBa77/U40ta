<template>
  <!--
    Секция показывается только когда данные загрузились и объекты есть.
    Если объектов нет — секции нет вообще (никакого «нет данных»).
  -->
  <div v-if="!isLoading && objects.length > 0">
    <section class="max-w-[1000px] mx-auto px-4 w-full py-4">
      <!-- Заголовок секции -->
      <div class="flex items-center justify-between gap-3 mb-2">
        <h2 class="text-base font-semibold text-gray-800">
          Объекты МОЛ
          <span class="text-sm font-normal text-gray-400 ml-1">
            ({{ filteredObjects.length }} / {{ objects.length }})
          </span>
        </h2>
        <button
          v-if="hasActiveFilters"
          class="border border-amber-400 bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg text-xs
                 active:bg-amber-100 transition whitespace-nowrap"
          title="Сбросить все фильтры"
          @click="resetAllFilters"
        >
          Сбросить
        </button>
      </div>

      <!--
        Таблица без горизонтальной прокрутки: table-fixed + ширины в процентах,
        длинный текст обрезается (truncate), полное значение — в атрибуте title.
      -->
      <div class="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <table class="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col v-for="col in tableColumns" :key="col.id" :style="{ width: col.width }" />
          </colgroup>
          <thead>
            <tr>
              <th class="bg-gray-50 px-2 py-2.5 text-center font-semibold text-gray-800 border-b-2 border-gray-200">
                №
              </th>
              <th
                v-for="col in columns"
                :key="col.id"
                :class="[
                  'bg-gray-50 px-2 py-2.5 text-left font-semibold border-b-2 border-gray-200 select-none cursor-pointer active:bg-gray-200',
                  hasFilter(col.id) ? 'text-blue-600' : 'text-gray-800'
                ]"
                @click="openFilterModal(col.id)"
              >
                <div class="flex items-center gap-1 min-w-0">
                  <span class="truncate">{{ col.title }}</span>
                  <span v-if="hasFilter(col.id)" class="shrink-0 text-blue-500">▼</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(obj, index) in filteredObjects"
              :key="obj.id"
              class="border-b border-gray-100 last:border-b-0"
            >
              <td class="px-2 py-2 text-center text-gray-400 text-xs">
                {{ index + 1 }}
              </td>
              <td v-for="col in columns" :key="col.id" class="px-2 py-2 text-gray-700">
                <div class="truncate" :title="cellText(obj, col) || undefined">
                  {{ cellText(obj, col) || '—' }}
                </div>
              </td>
            </tr>

            <!-- Фильтры отсеяли всё, но сами объекты есть — секция остаётся -->
            <tr v-if="filteredObjects.length === 0">
              <td :colspan="tableColumns.length" class="px-2 py-6 text-center text-gray-400 text-sm italic">
                Нет объектов по фильтрам
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Модалка выбора значений фильтра -->
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import { useTableFilter } from '@/composables/useTableFilter'
import { useSSE } from '@/composables/useSSE'
import { molService } from '@/services/mol.service'

const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

const isLoading = ref(true)
const objects = ref([])

/**
 * Колонки таблицы: порядок в массиве задаёт и порядок колонок, и порядок
 * фильтров. «№» — техническая колонка, в фильтрах не участвует.
 *
 * Поле `title` (а не `label`) — потому что useTableFilter берёт заголовок
 * модалки фильтра именно из `column.title`. В SearchModal конфигурация написана
 * с `label`, и модалка показывает «Фильтр по placeUser» вместо «Пользователь».
 *
 * Ширины — в процентах и в сумме дают ровно 100: 6 («№») + 30 + 13 + 17 + 10
 * + 11 + 13. Проценты, а не пиксели, потому что таблица table-fixed: при нехватке
 * места обрезается текст ячейки (`truncate` + `title`), а не появляется
 * горизонтальная прокрутка, как в модалке поиска раздела МОЛ.
 */
const columns = [
  { id: 'buhName',   title: 'Наименование', width: '30%', getValue: (row) => row.buhName },
  { id: 'invNumber', title: 'Инв. номер',   width: '13%', getValue: (row) => row.invNumber },
  { id: 'placeUser', title: 'Пользователь', width: '17%', getValue: (row) => row.placeUser },
  { id: 'placeCab',  title: 'Кабинет',      width: '10%', getValue: (row) => row.placeCab },
  { id: 'placePos',  title: 'Позиция',      width: '11%', getValue: (row) => row.placePos },
  { id: 'placeTer',  title: 'Территория',   width: '13%', getValue: (row) => row.placeTer },
]

/** Колонки таблицы подряд: технический номер строки, затем поля объекта. */
const tableColumns = [
  { id: 'rowNumber', title: '№', width: '6%' },
  ...columns
]

const {
  filterModalState,
  hasActiveFilters,
  filteredData: filteredObjects,
  openFilterModal,
  closeFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  hasFilter
} = useTableFilter(objects, columns)

/**
 * Проверяет, активен ли режим полёта.
 * @returns {boolean}
 */
const checkFlightMode = () => {
  return localStorage.getItem(FLIGHT_MODE_KEY) === 'true'
}

/**
 * Текст ячейки: пустое значение отдаём пустой строкой,
 * чтобы в шаблоне подставить прочерк, а в title — ничего.
 * @param {Object} row — строка объекта
 * @param {Object} col — конфигурация колонки
 * @returns {string}
 */
const cellText = (row, col) => {
  const value = col.getValue(row)
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

/**
 * Загрузка объектов всех доступных складов одним запросом.
 */
const loadObjects = async () => {
  isLoading.value = true
  try {
    objects.value = await molService.getMolObjects()
  } catch (error) {
    console.error('[MolObjectsSection] Ошибка загрузки объектов МОЛа:', error)
    objects.value = []
  } finally {
    isLoading.value = false
  }
}

/**
 * Обработчик SSE: список зависит и от самих объектов, и от доступов МОЛа.
 * @param {Object} data
 */
const handleSSEMessage = (data) => {
  if (data.type === 'objects-changed' || data.type === 'mol-access-changed') {
    loadObjects()
  }
}

useSSE(handleSSEMessage, { autoConnect: !checkFlightMode() })

onMounted(() => {
  loadObjects()
})
</script>
