<template>
  <div class="statement-table" ref="tableContainer">
    <table>
      <thead class="table-header">
        <tr>
          <th><!-- QR заголовок пустой --></th>
          <th>X</th>
          <th 
            @click="handleHeaderClick('inv_party_combined')"
            :class="['filterable-header', { 'filtered': hasFilter('inv_party_combined') }]"
          >
            Инв. номер
          </th>
          <th 
            @click="handleHeaderClick('buh_name')"
            :class="['filterable-header', { 'filtered': hasFilter('buh_name') }]"
          >
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
          <td @click.stop>
            <!-- Показываем кнопку сканирования только если:
                 1. Нет объекта (have_object = false)
                 2. Есть камера на устройстве
                 3. Строка актуальна (isActual = true)
            -->
            <QrScannerButton 
              v-if="shouldShowQrButton(row.original)"
              size="small"
              @scan="(scannedData) => handleQrScan(scannedData, row.original)"
              @error="handleQrError"
              @click.stop
            />
          </td>
          <td @click.stop>
            <input 
              type="checkbox" 
              :checked="getCheckboxValue(row.original)"
              @change="handleCheckboxChange(row.original, $event.target.checked)"
              @click.stop
            />
          </td>
          <td>
            <div class="inv-party-cell">
              <div class="inv-number">{{ getInvNumber(row.original) }}</div>
              <div class="party-number" v-if="hasPartyOrQuantity(row.original)">
                <span v-if="row.original.showParty && row.original.partyNumber" class="party-text">
                  {{ row.original.partyNumber }}
                </span>
                <span v-if="row.original.groupCount > 1" class="quantity-text">
                  {{ row.original.displayQuantity }}
                </span>
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
import { ref, computed, watch, onMounted } from 'vue'
import { 
  useVueTable, 
  getCoreRowModel 
} from '@tanstack/vue-table'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import { useCamera } from '@/composables/useCamera'

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
  },
  activeFilters: {
    type: Object,
    default: () => ({})
  },
  hasPartyOrQuantity: {
    type: Function,
    default: () => false
  }
})

const emit = defineEmits([
  'filter-click', 
  'actual-change', 
  'qr-scan',
  'row-click'
])

const tableContainer = ref(null)
const { hasCamera } = useCamera()

/**
 * Проверяет, нужно ли показывать кнопку QR-сканирования
 * @param {Object} row - строка таблицы
 * @returns {boolean}
 */
const shouldShowQrButton = (row) => {
  // Не показываем для неактуальных строк
  if (!row.isActual) return false
  
  // Проверяем наличие камеры
  if (!hasCamera.value) return false
  
  // Проверяем, что объект не создан
  const hasObject = row.have_object || row.haveObject || false
  return !hasObject
}

const table = useVueTable({
  data: props.statements,
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

/**
 * Обработчик клика по строке таблицы
 * Открывает модалку со списком объектов группы
 */
const handleRowClick = (row) => {
  if (!row.original.isActual) return // Неактуальные строки не открываем
  
  const rowData = row.original
  
  const groupParams = {
    invNumber: rowData.invNumber,
    partyNumber: rowData.partyNumber || null,
    zavod: rowData.zavod,
    sklad: rowData.sklad,
    originalRowIds: rowData.originalRowIds
  }
  
  emit('row-click', groupParams)
}

const handleQrScan = (scannedData, rowData) => {
  event?.stopPropagation()
  
  emit('qr-scan', {
    scannedData,
    rowData
  })
}

const handleQrError = (error) => {
  console.error('Ошибка сканирования QR:', error)
}

/**
 * Обработчик изменения чекбокса актуальности
 */
const handleCheckboxChange = (row, checked) => {
  event?.stopPropagation()
  
  // Инвертируем: checked = true значит "неактуально" (isActual = false)
  // или наоборот? Уточним логику
  const isActual = !checked // Если чекбокс отмечен (игнорировать) -> isActual = false
  
  emit('actual-change', {
    invNumber: row.invNumber,
    isActual: isActual
  })
}

const getCheckboxValue = (row) => {
  // Чекбокс отмечен, если строка НЕ актуальна
  return !row.isActual
}

const getInvNumber = (row) => {
  return row.invNumber || '—'
}

const getBuhName = (row) => {
  return row.buhName || '—'
}

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