<template>
  <table class="w-full border">
    <thead class="bg-gray-50">
      <tr>
        <th 
          v-for="header in table.getFlatHeaders()" 
          :key="header.id" 
          class="border p-3 text-left font-medium"
        >
          {{ header.column.columnDef.header }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td 
          v-for="cell in row.getVisibleCells()" 
          :key="cell.id" 
          class="border p-3"
        >
          {{ cell.getValue() }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
defineProps({
  table: Object,
  rows: Array
})
</script>