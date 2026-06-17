<template>
  <div class="statement-table flex-1 min-h-[300px] max-h-full border border-gray-200 rounded-lg bg-white overflow-auto relative">
    <table class="w-full border-collapse table-fixed min-w-[350px]">
      <thead class="sticky top-0 z-10 bg-gray-50">
        <tr>
          <th 
            class="w-8 px-2 py-3 text-left font-semibold text-sm text-gray-700 border-b-2 border-gray-200"
          >
            👁️
            <span class="sr-only">Актуально</span>
          </th>
          <th 
            @click="handleHeaderClick('inv_party_combined')"
            :class="[
              'px-3 py-3 text-left font-semibold text-sm text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition',
              { 'bg-yellow-50 border-l-2 border-l-yellow-500 border-r-2 border-r-yellow-500': hasFilter('inv_party_combined') }
            ]"
            style="min-width: 100px; max-width: 100px; width: 100px;"
          >
            Инв. номер
            <span v-if="hasFilter('inv_party_combined')" class="ml-1 text-amber-600">●</span>
          </th>
          <th 
            @click="handleHeaderClick('buh_name')"
            :class="[
              'px-3 py-3 text-left font-semibold text-sm text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition',
              { 'bg-yellow-50 border-l-2 border-l-yellow-500 border-r-2 border-r-yellow-500': hasFilter('buh_name') }
            ]"
          >
            Наименование
            <span v-if="hasFilter('buh_name')" class="ml-1 text-amber-600">●</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="(row, index) in statements"
          :key="index"
          :class="getRowClass(row)"
          class="cursor-pointer transition-colors"
          @click="handleRowClick(row)"
        >
          <td class="w-8 px-2 py-2 border-b border-gray-100 text-center align-middle" @click.stop>
            <input 
              v-if="!row.isExcess"
              type="checkbox" 
              :checked="row.isActual"
              @change="handleActualChange(row, $event.target.checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer"
            />
          </td>
          <td class="px-2 py-2 border-b border-gray-100 align-middle">
            <div class="inv-party-cell leading-tight">
              <div class="inv-number font-medium mb-0.5">{{ row.invNumber || '—' }}</div>
              <div class="party-number text-xs text-gray-500">
                <span v-if="row.showParty && row.partyNumber" class="party-text">
                  {{ row.partyNumber }}
                </span>
                <span v-if="row.displayQuantity" class="quantity-text text-xs font-semibold text-black ml-1">
                  {{ row.displayQuantity }}
                </span>
              </div>
            </div>
          </td>
          <td class="px-3 py-2 border-b border-gray-100 text-sm text-gray-600 align-middle">
            {{ row.buhName || '—' }}
          </td>
        </tr>
      </tbody>
    </table>
    
    <div v-if="!statements.length" class="text-center py-10 text-gray-500 text-sm">
      Нет данных для отображения
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент таблицы ведомости МОЛ.
 * Отображает сгруппированные строки с цветовой индикацией и чекбоксами актуальности.
 */

const props = defineProps({
  /**
   * Агрегированные строки ведомости
   */
  statements: {
    type: Array,
    required: true,
    default: () => []
  },
  /**
   * Функция для получения CSS-класса строки
   */
  getRowGroup: {
    type: Function,
    required: true
  },
  /**
   * Активные фильтры для подсветки заголовков
   */
  activeFilters: {
    type: Object,
    default: () => ({})
  },
  /**
   * Функция проверки наличия партии или количества
   */
  hasPartyOrQuantity: {
    type: Function,
    default: () => false
  }
})

const emit = defineEmits([
  'filter-click',
  'actual-change',
  'row-click'
])

/**
 * CSS-класс строки на основе группы.
 * isExcess → группа 6 (синий)
 * @param {Object} row - агрегированная строка
 * @returns {string}
 */
const getRowClass = (row) => {
  if (row.isExcess) return 'row-group-6'
  const group = props.getRowGroup(row)
  return `row-group-${group}`
}

/**
 * Проверяет, активен ли фильтр для колонки.
 * @param {string} columnId - ID колонки
 * @returns {boolean}
 */
const hasFilter = (columnId) => {
  const filters = props.activeFilters

  if (columnId === 'inv_party_combined') {
    return filters?.inv_number?.length > 0
  }
  if (columnId === 'buh_name') {
    return filters?.buh_name?.length > 0
  }
  return false
}

/**
 * Обработчик клика по заголовку.
 * @param {string} columnId - ID колонки
 */
const handleHeaderClick = (columnId) => {
  emit('filter-click', columnId)
}

/**
 * Обработчик клика по строке.
 * isExcess строки не кликабельны.
 * @param {Object} row - агрегированная строка
 */
const handleRowClick = (row) => {
  if (!row.isActual || row.isExcess) return

  emit('row-click', {
    invNumber: row.invNumber,
    partyNumber: row.partyNumber || null,
    zavod: row.zavod,
    sklad: row.sklad,
    originalRowIds: row.originalRowIds
  })
}

/**
 * Обработчик изменения чекбокса актуальности.
 * @param {Object} row - агрегированная строка
 * @param {boolean} checked - новое состояние чекбокса
 */
const handleActualChange = (row, checked) => {
  emit('actual-change', {
    invNumber: row.invNumber,
    isActual: checked
  })
}
</script>