<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <!-- Заголовок таблицы с position: sticky -->
      <thead class="table-header">
        <tr>
          <!-- QR колонка - без видимого текста на десктопе, пустая на мобильных -->
          <th @click="handleHeaderClick(table.getFlatHeaders()[0])">
            <span class="sr-only">QR</span>
          </th>
          
          <!-- Игнор колонка - "X" на мобильных, "Игнор" на десктопе -->
          <th @click="handleHeaderClick(table.getFlatHeaders()[1])">
            <span class="full-text">Игнор</span>
            <span class="short-text">X</span>
          </th>
          
          <!-- Остальные заголовки -->
          <th 
            v-for="header in table.getFlatHeaders().slice(2)" 
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
                :aria-label="`Игнорировать ${row.original.inv_number || row.original.invNumber || ''}`"
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
  if (!header) return
  console.log('Клик по заголовку:', header.column.id)
  // Здесь будет сортировка
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

/* Скрытый текст для скринридеров */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>