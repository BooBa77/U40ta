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
            style="min-width: 120px; max-width: 120px; width: 120px;"
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
          v-for="(row, index) in items"
          :key="index"
          :class="getRowClass(row)"
          class="cursor-pointer transition-colors"
          @click="handleRowClick(row)"
        >
          <td class="w-8 px-2 py-2 border-b border-gray-100 text-center align-middle" @click.stop>
            <input 
              type="checkbox" 
              :checked="row.isActual"
              @change="handleActualChange(row, $event.target.checked)"
              class="w-4 h-4 accent-blue-500 cursor-pointer"
            />
          </td>
          <td class="px-3 py-2 border-b border-gray-100 align-middle">
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
    
    <div v-if="!items.length" class="text-center py-10 text-gray-500 text-sm">
      Нет данных для отображения
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент таблицы инвентаризационной книги
 * Отображает сгруппированные строки с цветовой индикацией и чекбоксами актуальности
 */

const props = defineProps({
  /**
   * Агрегированные строки книги
   * @type {import('vue').PropType<Array<Object>>}
   */
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  /**
   * Функция для получения CSS-класса строки
   * @type {import('vue').PropType<Function>}
   * @param {Object} row - агрегированная строка
   * @returns {string} CSS-класс
   */
  getRowClass: {
    type: Function,
    required: true
  },
  /**
   * Активные фильтры для подсветки заголовков
   * @type {import('vue').PropType<Object>}
   */
  activeFilters: {
    type: Object,
    default: () => ({})
  },
})

const emit = defineEmits([
  /** @param {string} columnId - ID колонки для фильтрации */
  'filter-click',
  /** @param {Object} params - { invNumber, isActual } */
  'actual-change',
  /** @param {Object} groupParams - параметры выбранной группы */
  'row-click'
])

/**
 * Проверяет, активен ли фильтр для колонки
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
 * Обработчик клика по заголовку
 * @param {string} columnId - ID колонки
 */
const handleHeaderClick = (columnId) => {
  emit('filter-click', columnId)
}

/**
 * Обработчик клика по строке
 * @param {Object} row - агрегированная строка
 */
const handleRowClick = (row) => {
  if (!row.isActual) return

  emit('row-click', {
    invNumber: row.invNumber,
    partyNumber: row.partyNumber || null,
    zavod: row.items?.[0]?.zavod || 0,
    sklad: row.sklad,
    items: row.items
  })
}

/**
 * Обработчик изменения чекбокса актуальности
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

<style>
.statement-table {
  @media (max-width: 768px) {
    height: calc(100vh - 160px);
  }
}

.inv-number {
  font-weight: 500;
  margin-bottom: 2px;
}

.party-number {
  font-size: 0.8em;
  color: #6b7280;
}

.quantity-text {
  font-weight: 600;
  color: #000000;
}

@media (max-width: 768px) {
  .inv-number {
    font-size: 0.85em;
  }

  .party-number {
    font-size: 0.75em;
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
  }
}
</style>