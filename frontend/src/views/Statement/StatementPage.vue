<!-- src/views/Statement/StatementPage.vue -->
<template>
  <div class="statement-page p-4">
    <!-- Заголовок -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold">Тестовая таблица</h1>
      </div>
      <button
        @click="$router.push('/')"
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        ← Назад
      </button>
    </div>

    <!-- Тестовая таблица -->
    <div>
      <h2 class="text-xl font-semibold mb-4">Страны и столицы</h2>
      <DataTable 
        :table="testTable" 
        :rows="testRows"
        :columnFilters="testColumnFilters"
        :clearFilters="testClearFilters"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createColumnHelper } from '@tanstack/vue-table'
import { useDataTable } from '@/composables/useDataTable'
import DataTable from '@/components/ui/DataTable.vue'

const testData = ref([
  { id: 1, country: 'Россия', capital: 'Москва' },
  { id: 2, country: 'Германия', capital: 'Берлин' },
  { id: 3, country: 'Франция', capital: 'Париж' },
  { id: 4, country: 'Австралия', capital: 'Сидней' },  
])

const columnHelper = createColumnHelper()
const testColumns = [
  columnHelper.accessor('country', { 
    header: 'Страна',
    enableColumnFilter: true 
  }),
  columnHelper.accessor('capital', { 
    header: 'Столица',
    enableColumnFilter: true 
  })
]

const { 
  table: testTable, 
  rows: testRows, 
  columnFilters: testColumnFilters,
  clearFilters: testClearFilters,
  setFilterValue: testSetFilterValue,
  getFilterValue: testGetFilterValue
} = useDataTable(testData, testColumns, 'country')
</script>

<style scoped>
.statement-page {
  min-height: 100vh;
  background-color: #f9fafb;
}
</style>