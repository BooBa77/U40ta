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
          <td>
            <!-- Показываем кнопку сканирования только если:
                 1. Нет объекта (have_object = false)
                 2. Есть камера на устройстве
            -->
            <QrScannerButton 
              v-if="shouldShowQrButton(row.original)"
              size="small"
              @scan="(scannedData) => handleQrScan(scannedData, row.original)"
              @error="handleQrError"
            />
            <!-- Показываем плейсхолдер если камера есть, но объект уже создан -->
            <div 
              v-else-if="deviceHasCamera && (row.original.have_object || row.original.haveObject)"
              class="object-exists-icon" 
              title="Объект уже создан"
            >
              ✅
            </div>
            <!-- Если камеры нет, ничего не показываем (пустая ячейка) -->
          </td>
          <td>
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

const emit = defineEmits(['filter-click', 'ignore-change', 'qr-scan'])

const tableContainer = ref(null)
const deviceHasCamera = ref(false) // Состояние наличия камеры

// Проверка наличия камеры при монтировании компонента (как в Home.vue)
const checkCameraAvailability = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      deviceHasCamera.value = false
      return
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    const hasCamera = devices.some(device => device.kind === 'videoinput')
    deviceHasCamera.value = hasCamera
    
    console.log('[StatementTable] наличие камеры:', deviceHasCamera.value)
  } catch (error) {
    console.error('[StatementTable] ошибка проверки камеры:', error)
    deviceHasCamera.value = false
  }
}

// Метод для проверки условий отображения кнопки QR
const shouldShowQrButton = (row) => {
  // Не показываем для скрытых строк
  if (row.hiddenByGroup) return false
  
  // Проверяем наличие камеры
  if (!deviceHasCamera.value) return false
  
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

const handleRowClick = (row) => {
  console.log('Клик по строке:', row.original)
}

const handleQrScan = (scannedData, rowData) => {
  console.log('[StatementTable] QR отсканирован, передаём наверх')
  
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

// Проверяем наличие камеры при монтировании
onMounted(() => {
  checkCameraAvailability()
})

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