<template>
  <div 
    ref="tableContainer"
    class="statement-table flex-1 min-h-[300px] max-h-full border border-gray-200 rounded-lg bg-white overflow-auto relative"
  >
    <table class="w-full border-collapse table-fixed min-w-[350px]">
      <thead class="sticky top-0 z-10 bg-gray-50">
        <tr>
          <th 
            class="w-8 px-2 py-3 text-left font-semibold text-sm text-gray-700 border-b-2 border-gray-200"
          >
            👁️
            <span class="sr-only">Актуальность</span>
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
          v-for="(row, index) in items"
          :key="index"
          :class="getRowClass(row)"
          class="cursor-pointer transition-colors"
          @click="handleRowClick(row)"
        >
          <!-- Колонка актуальности: иконка глаза вместо чекбокса -->
          <td 
            class="w-8 px-2 py-2 border-b border-gray-100 text-center align-middle" 
            @click.stop
          >
            <span
              @click="handleActualChange(row, !row.isActual)"
              class="cursor-pointer text-lg select-none leading-none"
              :title="row.isActual ? 'Скрыть строку' : 'Вернуть строку'"
            >
              {{ row.isActual ? '👁️' : '🙈' }}
            </span>
          </td>

          <td class="px-2 py-2 border-b border-gray-100 align-middle">
            <div class="inv-party-cell leading-tight">
              <div class="inv-number font-medium mb-0.5">{{ row.invNumber || '—' }}</div>
              <div v-if="row.showParty && row.partyNumber" class="party-number text-xs text-gray-500">
                {{ row.partyNumber }}
              </div>
              <div v-if="row.totalCount > 1" class="quantity-text text-xs font-semibold text-black">
                {{ row.displayQuantity }}
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
 * Компонент таблицы инвентаризационной книги.
 * Отображает сгруппированные строки с цветовой индикацией и иконками актуальности.
 * Поддерживает сохранение позиции скролла при перерисовке через механизм якорей.
 */

import { ref, nextTick } from 'vue'

const props = defineProps({
  /**
   * Агрегированные строки книги
   */
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  /**
   * Функция для получения CSS-класса строки
   */
  getRowClass: {
    type: Function,
    required: true
  },
  /**
   * Активные фильтры для подсветки заголовков
   */
  activeFilters: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'filter-click',
  'actual-change',
  'row-click'
])

/** Ссылка на контейнер таблицы для скролла */
const tableContainer = ref(null)

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
 * Неактуальные строки (серые) не кликабельны.
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

// ============================================================
//  ЛОГИКА ЯКОРЯ ДЛЯ СОХРАНЕНИЯ ПОЗИЦИИ СКРОЛЛА
//
//  Типы якорей:
//  - 'return_to_active' — возврат строки из серых в активные.
//    Якорь ищется по invNumber (первая найденная строка).
//  - 'hide_to_inactive' — скрытие строки в серые.
//    Якорь ищется по invNumber + partyNumber + groupColor.
//  - 'modal_close' — закрытие InvListModal или InventoryCheckModal.
//    Якорь ищется по invNumber + partyNumber
//    (groupColor мог измениться после подтверждения).
// ============================================================

/**
 * Находит якорь для последующего скролла после перерисовки.
 * Вызывается ПЕРЕД эмитом actual-change.
 * 
 * @param {Object} row - строка, в которой изменился флаг актуальности
 * @param {boolean} newActual - новое значение isActual
 * @returns {Object|null} объект якоря или null, если скролл не нужен
 */
const findAnchor = (row, newActual) => {
  // Случай 1: возвращаем строку в активные (isActual = true)
  // После перерисовки она может развалиться на несколько строк
  // (разные party/sklad), якорь — любая строка с этим invNumber
  if (newActual) {
    return {
      type: 'return_to_active',
      invNumber: row.invNumber
    }
  }

  // Случай 2: скрываем строку (isActual = false)
  // Ищем в текущем массиве ближайшую сверху строку,
  // которая НЕ будет скрыта (isActual) и имеет другой invNumber.
  // Серых выше быть не может — они всегда в конце таблицы.
  const currentIndex = props.items.findIndex(
    s => s.invNumber === row.invNumber &&
         s.partyNumber === row.partyNumber &&
         s.isActual
  )

  if (currentIndex === -1) return null

  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = props.items[i]
    if (
      candidate.invNumber !== row.invNumber &&
      candidate.isActual
    ) {
      return {
        type: 'hide_to_inactive',
        invNumber: candidate.invNumber,
        partyNumber: candidate.partyNumber,
        groupColor: candidate.groupColor
      }
    }
  }

  // Дошли до верха таблицы — якоря нет, скролл не нужен
  return null
}

/**
 * Скроллит к строке-якорю после перерисовки таблицы.
 * Вызывается родителем (InventoryPage) после reload() и nextTick.
 * Ищет строку по данным (props.items), затем скроллит DOM-элемент.
 * 
 * @param {Object} anchor - объект якоря, сформированный findAnchor или вручную
 */
const scrollToAnchor = (anchor) => {
  if (!anchor || !tableContainer.value) return

  nextTick(() => {
    const rows = tableContainer.value.querySelectorAll('tbody tr')
    const itemsData = props.items

    let targetIndex = -1

    if (anchor.type === 'return_to_active') {
      // Ищем первую строку с совпадающим invNumber
      targetIndex = itemsData.findIndex(s => s.invNumber === anchor.invNumber)

    } else if (anchor.type === 'hide_to_inactive') {
      // Ищем точное совпадение inv + party + groupColor
      targetIndex = itemsData.findIndex(
        s => s.invNumber === anchor.invNumber &&
             s.partyNumber === anchor.partyNumber &&
             s.groupColor === anchor.groupColor
      )

    } else if (anchor.type === 'modal_close') {
      // Ищем совпадение inv + party, groupColor мог измениться
      targetIndex = itemsData.findIndex(
        s => s.invNumber === anchor.invNumber &&
             s.partyNumber === anchor.partyNumber
      )
    }

    if (targetIndex !== -1 && rows[targetIndex]) {
      rows[targetIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

/**
 * Обработчик изменения актуальности (клик по иконке глаза).
 * Находит якорь и эмитит событие в родителя.
 * 
 * @param {Object} row - агрегированная строка
 * @param {boolean} checked - новое состояние isActual
 */
const handleActualChange = (row, checked) => {
  const anchor = findAnchor(row, checked)
  emit('actual-change', {
    invNumber: row.invNumber,
    isActual: checked,
    anchor
  })
}

// Отдаём метод скролла родителю
defineExpose({ scrollToAnchor })
</script>

<style>
.debug-cells th {
  outline: 2px solid red;
  outline-offset: -2px;
}

.debug-cells td {
  outline: 2px solid blue;
  outline-offset: -2px;
}

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
}
</style>