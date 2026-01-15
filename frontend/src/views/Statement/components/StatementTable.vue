<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <thead class="table-header">
        <tr>
          <th @click="handleHeaderClick(table.getFlatHeaders()[0])">
            <!-- QR заголовок пустой -->
          </th>
          <th @click="handleHeaderClick(table.getFlatHeaders()[1])">
            X
          </th>
          <th @click="handleInvHeaderClick(table.getFlatHeaders()[2])">
            Инв. номер
          </th>
          <th @click="handleHeaderClick(table.getFlatHeaders()[3])">
            Наименование
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
  }
})

const tableContainer = ref(null)

const table = useVueTable({
  data: props.statements,
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

const handleHeaderClick = (header) => {
  if (!header) return
  console.log('Клик по заголовку:', header.column.id)
}

const handleInvHeaderClick = (header) => {
  if (!header) return
  console.log('Клик по заголовку Инв.номер - открыть модалку фильтрации')
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

// Убрали getQuantity

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