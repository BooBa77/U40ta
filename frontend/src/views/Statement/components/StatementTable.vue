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
          :class="[
            `row-group-${getRowGroup(row.original)}`,
            { 'group-hidden': row.original.hiddenByGroup }
          ]"
          @click="handleRowClick(row)"
        >
          <td @click.stop>
            <!-- Показываем кнопку сканирования только если:
                 1. Нет объекта (have_object = false)
                 2. Есть камера на устройстве
            -->
            <QrScannerButton 
              v-if="shouldShowQrButton(row.original)"
              size="small"
              @scan="(scannedData) => handleQrScan(scannedData, row.original)"
              @error="handleQrError"
              @click.stop
            />
            <!-- Показываем плейсхолдер если камера есть, но объект уже создан 
            <div 
              v-else-if="deviceHasCamera && (row.original.have_object || row.original.haveObject)"
              class="object-exists-icon" 
              title="Объект уже создан"
              @click.stop
            >
              ✅
            </div>
            -->
            <!-- Если камеры нет, ничего не показываем (пустая ячейка) -->
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
                <!-- Партия -->
                <div v-if="getPartyNumber(row.original)" class="party-text">
                  {{ getPartyNumber(row.original) }}
                </div>
                <!-- Количество на новой строке -->
                <div v-if="row.original.groupCount > 1 && row.original.isGroupRepresentative" class="quantity-text">
                  ({{ row.original.groupCount }} шт.)
                </div>
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
import { useCamera } from '@/composables/useCamera.js'

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
  'ignore-change', 
  'qr-scan',
  'row-click'  // Новый эмит для клика по строке
])

const tableContainer = ref(null)
const { hasCamera } = useCamera() // Состояние камеры

// Метод для проверки условий отображения кнопки QR
const shouldShowQrButton = (row) => {
  // Не показываем для скрытых строк
  if (row.hiddenByGroup) return false
  
  // Проверяем наличие камеры
  if (!hasCamera.value) return false
  
  // Проверяем, что объект не создан (have_object = false)
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
 * Открывает LocViewModal с параметрами группы
 */
const handleRowClick = (row) => {
  console.log('[StatementTable] Клик по строке:', row.original)
  
  // Не эмитим событие для скрытых строк
  if (row.original.hiddenByGroup) {
    console.log('[StatementTable] Строка скрыта, пропускаем')
    return
  }
  
  // Извлекаем данные для передачи в модалку
  const rowData = row.original
  
  // Формируем объект с параметрами группы
  const groupParams = {
    invNumber: rowData.inv_number || rowData.invNumber,
    partyNumber: rowData.party_number || rowData.partyNumber || null,
    zavod: rowData.zavod,
    sklad: rowData.sklad
  }
  
  console.log('[StatementTable] Эмит row-click с параметрами:', groupParams)
  emit('row-click', groupParams)
}

const handleQrScan = (scannedData, rowData) => {
  console.log('[StatementTable] QR отсканирован, передаём наверх')
  
  // Останавливаем всплытие, чтобы не сработал клик по строке
  event?.stopPropagation()
  
  // ПРОСТО передаём событие наверх
  emit('qr-scan', {
    scannedData,
    rowData
  })
}

const handleQrError = (error) => {
  console.error('Ошибка сканирования QR:', error)
}

const handleCheckboxChange = (row, checked) => {
  console.log('[StatementTable] Изменение чекбокса:', { row, checked })
  
  // Останавливаем всплытие, чтобы не сработал клик по строке
  event?.stopPropagation()
  
  const inv = row.inv_number || row.invNumber
  const party = row.party_number || row.partyNumber || ''
  
  emit('ignore-change', {
    inv,
    party,
    is_ignore: checked
  })
}

const getCheckboxValue = (row) => {
  return row.is_ignore || row.isIgnore || false
}

const getInvNumber = (row) => {
  return row.inv_number || row.invNumber || '—'
}

const getPartyNumber = (row) => {
  return row.party_number || row.partyNumber || ''
}

const getBuhName = (row) => {
  return row.buh_name || row.buhName || '—'
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