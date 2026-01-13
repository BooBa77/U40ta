<template>
  <div class="statement-table">
    <!-- Отдельный контейнер для шапки -->
    <div class="table-header-container" ref="headerContainer">
      <table class="header-table">
        <thead>
          <tr>
            <th 
              v-for="header in table.getFlatHeaders()" 
              :key="header.id"
              :colspan="header.colSpan"
              :style="{ width: `${header.getSize()}px` }"
              @click="handleHeaderClick(header)"
            >
              {{ header.column.columnDef.header }}
            </th>
          </tr>
        </thead>
      </table>
    </div>
    
    <!-- Контейнер для тела с скроллом -->
    <div class="table-body-container" ref="bodyContainer" @scroll="syncScroll">
      <table class="body-table">
        <tbody>
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td 
              v-for="cell in row.getVisibleCells()" 
              :key="cell.id"
              :style="{ width: `${cell.column.getSize()}px` }"
              @click="handleRowClick(row)"
            >
              <div v-if="cell.column.id === 'qr_action'">
                [QR]
              </div>
              <div v-else-if="cell.column.id === 'is_ignore'">
                <input 
                  type="checkbox" 
                  :checked="cell.getValue()"
                  @change="handleCheckboxChange(row.original.id, $event.target.checked)"
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
    
    <div class="scroll-indicator">
      Показано {{ table.getRowModel().rows.length }} строк
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
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
  }
})

const headerContainer = ref(null)
const bodyContainer = ref(null)

const table = useVueTable({
  data: props.statements,
  columns: props.columns,
  getCoreRowModel: getCoreRowModel(),
})

const handleHeaderClick = (header) => {
  console.log('Клик по заголовку:', header.column.id)
}

const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

const handleCheckboxChange = (rowId, checked) => {
  console.log('Чекбокс изменился:', rowId, checked)
}

// Синхронизация горизонтального скролла шапки и тела
const syncScroll = () => {
  if (headerContainer.value && bodyContainer.value) {
    headerContainer.value.scrollLeft = bodyContainer.value.scrollLeft
  }
}

// Установка одинаковой ширины колонок в шапке и теле
const syncColumnWidths = () => {
  nextTick(() => {
    const headerTable = headerContainer.value?.querySelector('.header-table')
    const bodyTable = bodyContainer.value?.querySelector('.body-table')
    
    if (headerTable && bodyTable) {
      // Устанавливаем одинаковую ширину таблиц
      const tableWidth = headerTable.offsetWidth
      bodyTable.style.width = `${tableWidth}px`
    }
  })
}

onMounted(() => {
  syncColumnWidths()
  window.addEventListener('resize', syncColumnWidths)
})

watch(() => props.statements, () => {
  table.setOptions(prev => ({
    ...prev,
    data: props.statements
  }))
  syncColumnWidths()
}, { deep: true })
</script>

<style scoped>
  @import './StatementTable.css';
</style>