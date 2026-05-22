<template>
  <div class="inventory-table" ref="tableContainer">
    <table>
      <thead class="table-header">
        <tr>
          <th 
            v-for="header in table.getFlatHeaders()"
            :key="header.id"
            :class="['filterable-header', { 'filtered': hasFilter(header.id) }]"
            @click="handleHeaderClick(header.id)"
          >
            {{ header.column.columnDef.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :class="getRowClass(row.original)"
          @click="handleRowClick(row)"
        >
          <td 
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
          >
            <component 
              :is="flexRender(cell.column.columnDef.cell, cell.getContext())"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useVueTable, getCoreRowModel, flexRender } from '@tanstack/vue-table'

const props = defineProps({
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  columns: {
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

const emit = defineEmits(['filter-click', 'ignore-change', 'row-click'])

const tableContainer = ref(null)

const table = useVueTable({
  data: props.items,
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
  const group = row.original
  emit('row-click', {
    invNumber: group.invNumber,
    partyNumber: group.partyNumber || null,
    zavod: group.items[0]?.zavod,
    sklad: group.sklad
  })
}

watch(() => props.items, () => {
  table.setOptions(prev => ({
    ...prev,
    data: props.items
  }))
}, { deep: true })
</script>

<style scoped>
@import './InventoryBookTable.css';
</style>