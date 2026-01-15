<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <thead class="table-header">
        <tr>
          <th><!-- QR заголовок пустой --></th>
          <th>X</th>
          <th 
            @click="handleHeaderClick('inv_party_combined')"
            class="filterable-header"
          >
            Инв. номер
            <span v-if="hasFilter('inv_party_combined')" class="filter-indicator">
              ⚡
            </span>
          </th>
          <th 
            @click="handleHeaderClick('buh_name')"
            class="filterable-header"
          >
            Наименование
            <span v-if="hasFilter('buh_name')" class="filter-indicator">
              ⚡
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :class="`row-group-${getRowGroup(row.original)}`"
          @click="handleRowClick(row)"
        >
          <td>
            <div class="qr-placeholder" @click.stop="handleQrClick(row.original)">
              [QR]
            </div>
          </td>
          <td>
            <input 
              type="checkbox" 
              :checked="getCheckboxValue(row.original)"
              @change="handleCheckboxChange(row.original.id, $event.target.checked)"
              @click.stop
            />
          </td>
          <td>
            <div class="inv-party-cell">
              <div class="inv-number">{{ getInvNumber(row.original) }}</div>
              <div class="party-number" v-if="hasPartyOrQuantity(row.original)">
                {{ getPartyNumber(row.original) }}
              </div>
            </div>
          </td>
          <td>
            {{ getBuhName(row.original) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { 
  useVueTable, 
  getCoreRowModel 
} from '@tanstack/vue-table'

const props = defineProps({
  statements: {
    type: Array,
    required: true,
    default: () => []
  },
  columns: {
    type: Array,
    required: true,
    default: () => []
  },
  getRowGroup: { 
    type: Function,
    required: true
  },
  activeFilters: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['filter-click'])

const tableContainer = ref(null)

const table = useVueTable({
  data: props.statements,
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

/**
 * Обработчик клика по заголовку
 */
const handleHeaderClick = (columnId) => {
  // Только эти колонки открывают фильтр
  if (columnId === 'inv_party_combined' || columnId === 'buh_name') {
    emit('filter-click', columnId)
  } else {
    // QR, Игнор - не открывают фильтр
    console.log('Клик по нефильтруемой колонке:', columnId)
  }
}

/**
 * Проверяет есть ли фильтр для колонки
 */
const hasFilter = (columnId) => {
  if (columnId === 'inv_party_combined') {
    // Для объединённой колонки проверяем фильтр по inv_number
    return props.activeFilters.inv_number && props.activeFilters.inv_number.length > 0
  }
  
  // Для остальных колонок проверяем по их ID
  return props.activeFilters[columnId] && props.activeFilters[columnId].length > 0
}

const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

const handleQrClick = (rowData) => {
  console.log('QR клик по строке:', rowData)
}

const handleCheckboxChange = (rowId, checked) => {
  console.log('Чекбокс изменился:', rowId, checked)
}

const getRowGroup = (row) => {
  return props.getRowGroup(row)
}

const getCheckboxValue = (row) => {
  return row.is_ignore || row.isIgnore || false
}

const getInvNumber = (row) => {
  return row.inv_number || row.invNumber || '—'
}

const getPartyNumber = (row) => {
  const party = row.party_number || row.partyNumber || ''
  const quantity = row.quantity || 1
  
  if (!party) return ''
  
  if (quantity > 1) {
    return `${party} (${quantity} шт.)`
  }
  
  return party
}

const hasPartyOrQuantity = (row) => {
  const party = row.party_number || row.partyNumber || ''
  const quantity = row.quantity || 1
  
  // Показываем блок, если есть партия ИЛИ quantity > 1
  return party !== '' || quantity > 1
}

const getBuhName = (row) => {
  return row.buh_name || row.buhName || '—'
}

watch(() => props.statements, () => {
  table.setOptions(prev => ({
    ...prev,
    data: props.statements
  }))
}, { deep: true })
</script>

<style scoped>
@import './StatementTable.css';

/* Стили для заголовков с фильтрами */
.filterable-header {
  cursor: pointer;
  position: relative;
}

.filterable-header:hover {
  background-color: #f3f4f6;
}

.filter-indicator {
  margin-left: 6px;
  font-size: 0.9em;
  color: #3b82f6;
  display: inline-block;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Мобильная адаптация */
@media (max-width: 768px) {
  .filter-indicator {
    font-size: 0.8em;
    margin-left: 4px;
  }
}
</style>