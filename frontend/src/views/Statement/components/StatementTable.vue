<template>
  <div class="statement-table">
    <!-- Контейнер для шапки таблицы -->
    <div class="table-header-container" ref="headerContainer">
      <table class="header-table">
        <thead>
          <tr>
            <th 
              v-for="header in table.getFlatHeaders()" 
              :key="header.id"
              :colspan="header.colSpan"
              @click="handleHeaderClick(header)"
              :data-column-index="header.index"
              :style="getColumnStyle(header.index)"
            >
              {{ header.column.columnDef.header }}
            </th>
          </tr>
        </thead>
      </table>
    </div>
    
    <!-- Контейнер для тела таблицы со скроллом -->
    <div class="table-body-container" ref="bodyContainer" @scroll="syncScroll">
      <table class="body-table">
        <tbody>
          <tr 
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="`row-group-${getRowGroup(row.original)}`"
          >
            <td 
              v-for="cell in row.getVisibleCells()" 
              :key="cell.id"
              @click="handleRowClick(row)"
              :data-column-index="cell.column.index"
              :style="getColumnStyle(cell.column.index)"
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
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
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

// Рефы для контейнеров таблицы
const headerContainer = ref(null)
const bodyContainer = ref(null)

// Объект для хранения вычисленных ширин колонок
const columnWidths = ref({})

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
 * Обработчик изменения состояния чекбокса
 */
const handleCheckboxChange = (rowId, checked) => {
  console.log('Чекбокс изменился:', rowId, checked)
}

/**
 * Получение класса для строки на основе группы
 * Теперь используем getRowGroup из пропсов
 */
const getRowClass = (row) => {
  const group = props.getRowGroup(row)
  return `row-group-${group}`
}

/**
 * Получение стилей для колонки по индексу
 */
const getColumnStyle = (columnIndex) => {
  if (columnWidths.value[columnIndex]) {
    return { 
      width: `${columnWidths.value[columnIndex]}px`,
      minWidth: `${columnWidths.value[columnIndex]}px`,
      maxWidth: `${columnWidths.value[columnIndex]}px`
    }
  }
  return {}
}

/**
 * Вычисление оптимальных ширин колонок на основе содержимого
 */
const calculateColumnWidths = () => {
  nextTick(() => {
    const bodyTable = bodyContainer.value?.querySelector('.body-table')
    if (!bodyTable) return
    
    const rows = bodyTable.querySelectorAll('tbody tr')
    if (rows.length === 0) return
    
    // Берем первую строку для получения количества колонок
    const firstRowCells = rows[0].querySelectorAll('td')
    const columnCount = firstRowCells.length
    
    const newWidths = {}
    
    // Для каждой колонки вычисляем максимальную ширину
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      let maxWidth = 0
      
      // Проверяем ширину в каждой строке
      rows.forEach(row => {
        const cell = row.children[colIndex]
        if (cell) {
          // Временно снимаем ограничение по ширине для измерения
          cell.style.whiteSpace = 'nowrap'
          cell.style.overflow = 'visible'
          
          const contentWidth = cell.scrollWidth
          const cellWidth = cell.offsetWidth
          
          // Возвращаем стили
          cell.style.whiteSpace = ''
          cell.style.overflow = ''
          
          // Учитываем отступы (примерно 20px)
          const padding = 20
          const requiredWidth = Math.max(cellWidth, contentWidth + padding)
          
          if (requiredWidth > maxWidth) {
            maxWidth = requiredWidth
          }
        }
      })
      
      // Устанавливаем минимальную ширину из CSS
      const minWidth = getMinWidthFromCSS(colIndex + 1)
      newWidths[colIndex] = Math.max(maxWidth, minWidth || 60)
    }
    
    columnWidths.value = newWidths
  })
}

/**
 * Получение минимальной ширины колонки из CSS по номеру колонки
 */
const getMinWidthFromCSS = (columnIndex) => {
  // Соответствие номеров колонок минимальным ширинам из CSS
  const minWidths = {
    1: 60,  // QR
    2: 60,  // Игнор
    3: 140, // Инв. номер
    4: 100, // Партия
    5: 200, // Наименование
    6: 70   // Кол-во
  }
  return minWidths[columnIndex]
}

/**
 * Синхронизация горизонтального скролла шапки и тела таблицы
 */
const syncScroll = () => {
  if (headerContainer.value && bodyContainer.value) {
    headerContainer.value.scrollLeft = bodyContainer.value.scrollLeft
  }
}

/**
 * Обработчик изменения размеров окна
 */
const handleResize = () => {
  calculateColumnWidths()
}

// Инициализация при монтировании компонента
onMounted(() => {
  calculateColumnWidths()
  window.addEventListener('resize', handleResize)
})

// Очистка при размонтировании
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Отслеживание изменения данных для пересчета ширины
watch(() => props.statements, () => {
  table.setOptions(prev => ({
    ...prev,
    data: props.statements
  }))
  
  // Даем время на рендер новых данных
  setTimeout(calculateColumnWidths, 100)
}, { deep: true })
</script>

<style scoped>
  @import './StatementTable.css';
</style>