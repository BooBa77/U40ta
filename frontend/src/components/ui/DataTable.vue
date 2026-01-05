<template>
  <div>
    <!-- Кнопка сброса фильтров -->
    <div v-if="columnFilters && columnFilters.length > 0" class="mb-4">
      <button @click="clearFilters" class="px-3 py-1 bg-gray-200 rounded text-sm">
        Сбросить фильтры ({{ columnFilters.length }})
      </button>
    </div>

    <table class="w-full border" v-if="table">
      <thead class="bg-gray-50">
        <!-- Строка с названиями колонок -->
        <tr>
          <th 
            v-for="header in table.getFlatHeaders()" 
            :key="header.id" 
            class="border p-3 text-left font-medium"
          >
            {{ header.column?.columnDef.header }}
          </th>
        </tr>
        <!-- Строка с фильтрами -->
        <tr>
          <td 
            v-for="header in table.getFlatHeaders()" 
            :key="header.id + '-filter'"
            class="border p-2"
          >
            <input
              v-if="header.column?.getCanFilter()"
              :value="header.column.getFilterValue() || ''"
              @input="header.column.setFilterValue($event.target.value)"
              placeholder="Фильтр..."
              class="w-full px-2 py-1 border rounded text-sm"
            />
          </td>
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
  </div>
</template>

<script setup>
defineProps({
  table: Object,
  rows: Array,
  columnFilters: {
    type: Array,
    default: () => []
  },
  clearFilters: {
    type: Function,
    default: () => {}
  }
})
</script>