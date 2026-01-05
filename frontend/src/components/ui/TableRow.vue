<!-- src/components/ui/TableRow.vue -->
<template>
  <tr
    :class="[
      'hover:bg-gray-50 transition-colors',
      onRowClick ? 'cursor-pointer' : ''
    ]"
    @click="handleClick"
  >
    <td
      v-for="cell in row.getVisibleCells()"
      :key="cell.id"
      class="p-3 border-b border-gray-100"
    >
      <!-- Используем FlexRender напрямую -->
      <FlexRender
        :render="cell.column.columnDef.cell"
        :props="cell.getContext()"
      />
    </td>
  </tr>
</template>

<script setup>
import { FlexRender } from '@tanstack/vue-table'

const props = defineProps({
  row: { type: Object, required: true },
  onRowClick: { type: Function, default: null }
})

const handleClick = () => {
  if (props.onRowClick) {
    props.onRowClick(props.row.original)
  }
}
</script>