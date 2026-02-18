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
            <QrScannerButton 
              size="small"
              @scan="(scannedData) => handleQrScan(scannedData, row.original)"
              @error="handleQrError"
            />
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
// ДОБАВЛЯЕМ импорт
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'

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
  hasPartyOrQuantity: {
    type: Function,
    default: () => false
  }
})

// ДОБАВЛЯЕМ события
const emit = defineEmits(['filter-click', 'ignore-change', 'qr-scan'])

const tableContainer = ref(null)

const table = useVueTable({
  data: props.statements,
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

const handleHeaderClick = (columnId) => {
  if (columnId === 'inv_party_combined' || columnId === 'buh_name') {
    emit('filter-click', columnId)
  }
}

const hasFilter = (columnId) => {
  if (columnId === 'inv_party_combined') {
    return props.activeFilters.inv_number && props.activeFilters.inv_number.length > 0
  }
  
  return props.activeFilters[columnId] && props.activeFilters[columnId].length > 0
}

const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

// ДОБАВЛЯЕМ обработчик QR сканирования
const handleQrScan = (scannedData, rowData) => {
  console.log('[StatementTable] QR отсканирован, передаём наверх')
  
  // ПРОСТО передаём событие наверх
  emit('qr-scan', {
    scannedData,
    rowData
  })
}

// ДОБАВЛЯЕМ обработчик ошибок QR
const handleQrError = (error) => {
  console.error('Ошибка сканирования QR:', error)
}

const handleCheckboxChange = (row, checked) => {
  const inv = row.inv_number || row.invNumber
  const party = row.party_number || row.partyNumber || ''
  
  emit('ignore-change', {
    inv,
    party,
    is_ignore: checked
  })
}

const getCheckboxValue = (row) => {
  return row.is_ignore || row.isIgnore || false
}

const getInvNumber = (row) => {
  return row.inv_number || row.invNumber || '—'
}

const getPartyNumber = (row) => {
  return row.party_number || row.partyNumber || ''
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
</style>