<template>
  <div class="overflow-x-auto flex-1 min-h-0 border border-gray-200 rounded-lg bg-white">
    <table class="w-full border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-gray-50">
        <tr>
          <!-- Чекбокс isActual -->
          <th class="w-10 px-2 py-3 text-center font-semibold text-gray-800 border-b-2 border-gray-200">
            <span class="sr-only">Актуально</span>
          </th>
          
          <!-- Инв. номер + партия + кол-во-->
          <th 
            class="px-3 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 min-w-[200px] cursor-pointer hover:bg-gray-100 transition"
            :class="{ 'bg-amber-50': hasFilter('inv_party_combined') }"
            @click="handleHeaderClick('inv_party_combined')"
          >
            Инв. номер
            <span v-if="hasFilter('inv_party_combined')" class="ml-1 text-amber-600">●</span>
          </th>
          
          <!-- Наименование -->
          <th 
            class="px-3 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition"
            :class="{ 'bg-amber-50': hasFilter('buh_name') }"
            @click="handleHeaderClick('buh_name')"
          >
            Наименование
            <span v-if="hasFilter('buh_name')" class="ml-1 text-amber-600">●</span>
          </th>
        </tr>
      </thead>
      
      <tbody>
        <tr 
          v-for="(row, index) in items" 
          :key="`${row.invNumber}_${row.partyNumber || ''}_${index}`"
          :class="[getRowClass(row), 'cursor-pointer hover:opacity-90 transition']"
          @click="handleRowClick(row)"
        >
          <!-- Чекбокс isActual -->
          <td class="w-10 px-2 py-3 text-center border-b border-gray-100">
            <input 
              type="checkbox"
              :checked="row.isActual !== false"
              @click.stop
              @change="handleActualChange(row)"
              class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
          </td>

          <!-- Инв. номер + партия + количество -->
          <td class="px-3 py-3 border-b border-gray-100">
            <div v-if="row.docTypeDisplay" class="text-xs text-gray-400 mb-0.5">
              {{ row.docTypeDisplay }}
            </div>
            <div class="font-medium">{{ row.invNumber }}</div>
            <div v-if="row.partyNumber || row.displayQuantity" class="text-xs text-gray-500 mt-0.5">
              <span v-if="row.partyNumber" class="party-text">
                {{ row.partyNumber }}
              </span>
              <span v-if="row.displayQuantity" class="quantity-text text-xs font-semibold text-black ml-1">
                {{ row.displayQuantity }}
              </span>
            </div>
          </td>
          
          <!-- Наименование -->
          <td class="px-3 py-3 border-b border-gray-100 text-gray-600">
            {{ row.buhName || '—' }}
          </td>
        </tr>
        
        <!-- Пустое состояние -->
        <tr v-if="items.length === 0">
          <td colspan="3" class="text-center py-10 px-5 text-gray-400 italic">
            Нет данных для отображения
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
/**
 * Компонент таблицы инвентаризационной книги
 * Отображает сгруппированные строки с цветовой индикацией и чекбоксами актуальности
 */

const props = defineProps({
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  getRowClass: {
    type: Function,
    required: true
  },
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

const hasFilter = (columnId) => {
  if (columnId === 'inv_party_combined') {
    return props.activeFilters.inv_number && props.activeFilters.inv_number.length > 0
  }
  return props.activeFilters[columnId] && props.activeFilters[columnId].length > 0
}

const handleHeaderClick = (columnId) => {
  if (columnId === 'inv_party_combined' || columnId === 'buh_name') {
    emit('filter-click', columnId)
  }
}

const handleActualChange = (row) => {
  emit('actual-change', {
    invNumber: row.invNumber,
    isActual: !row.isActual
  })
}

const handleRowClick = (row) => {
  emit('row-click', {
    invNumber: row.invNumber,
    partyNumber: row.partyNumber,
    zavod: row.items?.[0]?.zavod || 0,
    sklad: row.sklad
  })
}
</script>