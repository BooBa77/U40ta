<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <thead class="table-header">
        <tr>
          <th><!-- QR заголовок пустой --></th>
          <th>X</th>
          <th 
            @click="handleHeaderClick('inv_party_combined')"
            :class="['filterable-header', { 'filtered': hasFilter('inv_party_combined') }]"
          >
            Инв. номер
          </th>
          <th 
            @click="handleHeaderClick('buh_name')"
            :class="['filterable-header', { 'filtered': hasFilter('buh_name') }]"
          >
            Наименование
          </th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :class="[
            `row-group-${getRowGroup(row.original)}`,
            { 'group-hidden': row.original.hiddenByGroup }
          ]"
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
              @change="handleCheckboxChange(row.original, $event.target.checked)"
              @click.stop
            />
          </td>

          <td>
            <div class="inv-party-cell">
              <div class="inv-number">{{ getInvNumber(row.original) }}</div>
              <div class="party-number" v-if="hasPartyOrQuantity(row.original)">
                <!-- Партия -->
                <div v-if="getPartyNumber(row.original)" class="party-text">
                  {{ getPartyNumber(row.original) }}
                </div>
                <!-- Количество на новой строке -->
                <div v-if="row.original.groupCount > 1 && row.original.isGroupRepresentative" class="quantity-text">
                  ({{ row.original.groupCount }} шт.)
                </div>
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
import { ref, computed, watch } from 'vue'
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
  },
  hasPartyOrQuantity: { // ← Этот пропс есть
    type: Function,
    default: () => false
  }
})

const emit = defineEmits(['filter-click', 'ignore-change'])

const tableContainer = ref(null)

/**
 * Инициализация таблицы
 */
const table = useVueTable({
  data: props.statements, // ← Теперь получаем уже обработанные данные
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

/**
 * Обработчик клика по заголовку
 */
const handleHeaderClick = (columnId) => {
  if (columnId === 'inv_party_combined' || columnId === 'buh_name') {
    emit('filter-click', columnId)
  }
}

/**
 * Проверяет есть ли фильтр для колонки
 */
const hasFilter = (columnId) => {
  if (columnId === 'inv_party_combined') {
    return props.activeFilters.inv_number && props.activeFilters.inv_number.length > 0
  }
  
  return props.activeFilters[columnId] && props.activeFilters[columnId].length > 0
}

/**
 * Обработчик клика по строке таблицы
 */
const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

/**
 * Обработчик клика по QR-коду
 */
const handleQrClick = (rowData) => {
  console.log('QR клик по строке:', rowData)
}

/**
 * Обработчик изменения чекбокса игнора
 */
const handleCheckboxChange = (row, checked) => {
  const inv = row.inv_number || row.invNumber
  const party = row.party_number || row.partyNumber || ''
  
  emit('ignore-change', {
    inv,
    party,
    is_ignore: checked
  })
}

/**
 * Возвращает значение чекбокса
 */
const getCheckboxValue = (row) => {
  return row.is_ignore || row.isIgnore || false
}

/**
 * Возвращает инвентарный номер
 */
const getInvNumber = (row) => {
  return row.inv_number || row.invNumber || '—'
}

const getPartyNumber = (row) => {
  return row.party_number || row.partyNumber || ''
}

/**
 * Возвращает бухгалтерское наименование
 */
const getBuhName = (row) => {
  return row.buh_name || row.buhName || '—'
}

/**
 * Следим за изменениями данных и обновляем таблицу
 */
watch(() => props.statements, () => {
  table.setOptions(prev => ({
    ...prev,
    data: props.statements
  }))
}, { deep: true })
</script>

<style scoped>
@import './StatementTable.css';
</style>