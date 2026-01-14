<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <!-- Заголовок таблицы с position: sticky -->
      <thead class="table-header">
        <tr>
          <th 
            v-for="header in table.getFlatHeaders()" 
            :key="header.id"
            :colspan="header.colSpan"
            @click="handleHeaderClick(header)"
          >
            {{ header.column.columnDef.header }}
          </th>
        </tr>
      </thead>
      
      <!-- Тело таблицы -->
      <tbody>
        <tr 
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :class="`row-group-${getRowGroup(row.original)}`"
          @click="handleRowClick(row)"
        >
          <td 
            v-for="cell in row.getVisibleCells()" 
            :key="cell.id"
          >
            <div v-if="cell.column.id === 'qr_action'">
              <div class="qr-placeholder" @click.stop="handleQrClick(row.original)">
                [QR]
              </div>
            </div>
            <div v-else-if="cell.column.id === 'is_ignore'">
              <input 
                type="checkbox" 
                :checked="cell.getValue()"
                @change="handleCheckboxChange(row.original.id, $event.target.checked)"
                @click.stop
              />
            </div>
            <span v-else>
              {{ cell.getValue() ?? '—' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
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

// Инициализация таблицы TanStack Table
const table = useVueTable({
  data: props.statements,
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

/**
 * Обработчик клика по заголовку колонки
 */
const handleHeaderClick = (header) => {
  console.log('Клик по заголовку:', header.column.id)
}

/**
 * Обработчик клика по строке таблицы
 */
const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

/**
 * Обработчик клика по QR кнопке
 */
const handleQrClick = (rowData) => {
  console.log('QR клик по строке:', rowData)
  // Здесь будет вызов сканера QR
}

/**
 * Обработчик изменения состояния чекбокса
 */
const handleCheckboxChange = (rowId, checked) => {
  console.log('Чекбокс изменился:', rowId, checked)
}

/**
 * Получение класса для строки на основе группы
 */
const getRowGroup = (row) => {
  return props.getRowGroup(row)
}

// Отслеживание изменения данных
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