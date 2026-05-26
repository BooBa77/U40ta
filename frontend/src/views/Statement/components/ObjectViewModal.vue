<template>
  <BaseModal
    :is-open="isOpen"
    :show-header="true"
    :title="modalTitle"
    :width="'600px'"
    :max-width="'90vw'"
    @close="handleClose"
  >
    <!-- Состояние загрузки -->
    <div v-if="isLoading" class="py-10 px-5 text-center text-gray-500">
      Загрузка данных...
    </div>

    <!-- Состояние ошибки -->
    <div v-else-if="error" class="py-10 px-5 text-center text-red-600">
      {{ error }}
      <button 
        @click="loadData" 
        class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
      >
        Повторить
      </button>
    </div>

    <!-- Таблица с данными -->
    <div v-else class="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg my-4 max-sm:max-h-[300px] max-sm:my-3">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 w-[50px] text-center max-sm:w-10 max-sm:px-1.5 max-sm:py-2 max-sm:text-xs">
              №
            </th>
            <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 min-w-[200px] max-sm:min-w-[150px] max-sm:px-1.5 max-sm:py-2 max-sm:text-xs">
              Местоположение
            </th>
            <th class="sticky top-0 z-10 bg-gray-50 px-3 py-3 text-right font-semibold text-gray-800 border-b-2 border-gray-200 w-[100px] max-sm:w-20 max-sm:px-1.5 max-sm:py-2 max-sm:text-xs">
              Действие
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(item, index) in combinedItems" 
            :key="item.id || item.statementId" 
            class="hover:bg-gray-50 transition-colors"
          >
            <td class="px-2 py-2.5 border-b border-gray-100 text-center text-gray-500 font-medium max-sm:px-1.5 max-sm:py-2">
              {{ index + 1 }}
            </td>
            <td class="px-2 py-2.5 border-b border-gray-100 text-gray-600 max-sm:px-1.5 max-sm:py-2">
              {{ getLocationDisplay(item) }}
            </td>
            <td class="px-3 py-2.5 border-b border-gray-100 text-right max-sm:px-1.5 max-sm:py-2">
              <!-- Для существующих объектов - кнопка Открыть -->
              <button 
                v-if="item.isObject" 
                @click="openObjectForm(item)"
                class="px-3 py-1.5 bg-blue-500 text-white border border-blue-600 rounded text-xs font-medium hover:bg-blue-600 transition max-sm:px-2 max-sm:py-1 max-sm:text-[0.7rem]"
              >
                Открыть
              </button>
              
              <!-- Для записей ведомости - QrScannerButton -->
              <QrScannerButton 
                v-else-if="hasCamera"
                @scan="(scannedData) => handleQrScan(scannedData, item)"
                @error="handleQrError"
              />
            </td>
          </tr>
          
          <!-- Пустое состояние -->
          <tr v-if="combinedItems.length === 0">
            <td colspan="3" class="text-center py-10 px-5 text-gray-400 italic">
              Нет данных для отображения
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Вложенная модалка ObjectForm -->
    <ObjectFormModal
      :is-open="objectFormIsOpen"
      :object-id="objectFormObjectId"
      :initial-data="objectFormInitialData"
      :initial-qr-code="objectFormQrCode"
      @save="handleObjectFormSave"
      @cancel="handleObjectFormCancel"
    />
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import { objectService } from '@/services/object-service'
import { statementService } from '@/services/statement.service'
import { useCamera } from '@/composables/useCamera'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  invNumber: {
    type: String,
    required: true
  },
  partyNumber: {
    type: String,
    default: null
  },
  zavod: {
    type: [Number, String],
    required: true
  },
  sklad: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

// ============ СОСТОЯНИЯ ============
const isLoading = ref(false)
const error = ref('')
const statementRows = ref([]) // Записи из ведомости (с haveObject = false)
const objectRows = ref([])    // Существующие объекты
const { hasCamera } = useCamera() // Состояние камеры

// Состояние для ObjectFormModal
const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormStatementId = ref(null)
const objectFormInitialData = ref({})
const objectFormQrCode = ref(null)

// ============ COMPUTED ============
const modalTitle = computed(() => {
  return `Инв. № ${props.invNumber} / Склад ${props.sklad}`
})

/**
 * Объединённый список для отображения
 * Сначала идут записи из ведомости (проблемные), потом существующие объекты
 */
const combinedItems = computed(() => {
  const items = []
  
  // Добавляем записи из ведомости с флагом haveObject = false
  statementRows.value.forEach(row => {
    items.push({
      ...row,
      isObject: false,
      // Сохраняем statementId для обновления статуса
      statementId: row.id
    })
  })
  
  // Добавляем существующие объекты
  objectRows.value.forEach(obj => {
    items.push({
      ...obj,
      isObject: true,
      objectId: obj.id
    })
  })
  
  return items
})

// ============ МЕТОДЫ ЗАГРУЗКИ ДАННЫХ ============
/**
 * Загружает данные из обоих источников параллельно
 */
const loadData = async () => {
  console.log('[LocViewModal] Загрузка данных для:', {
    inv: props.invNumber,
    party: props.partyNumber,
    zavod: props.zavod,
    sklad: props.sklad
  })
  
  isLoading.value = true
  error.value = ''
  
  try {
    // Загружаем параллельно для производительности
    const [statements, objects] = await Promise.all([
      statementService.getStatementsByInv(
        props.invNumber,
        props.partyNumber,
        props.zavod,
        props.sklad
      ),
      objectService.getObjectsByInv(
        props.invNumber,
        props.partyNumber,
        props.zavod,
        props.sklad
      )
    ])
    
    console.log('[LocViewModal] Загружено записей ведомости:', statements.length)
    console.log('[LocViewModal] Загружено объектов:', objects.length)
    
    statementRows.value = statements
    objectRows.value = objects
    
  } catch (err) {
    console.error('[LocViewModal] Ошибка загрузки:', err)
    error.value = err.message || 'Не удалось загрузить данные'
  } finally {
    isLoading.value = false
  }
}

/**
 * Определяет отображаемое местоположение по приоритету:
 * placeUser -> placeCab -> placePos -> placeTer -> "-"
 */
const getLocationDisplay = (item) => {
  if (item.placeUser && item.placeUser.length >= 3) {
    return item.placeUser
  }
  if (item.placeCab && item.placeCab.length >= 3) {
    return item.placCab
  }
  if (item.placePos && item.placePos.length >= 3) {
    return item.placePos
  }
  if (item.placeTer && item.placeTer.length >= 3) {
    return item.placeTer
  }
  return '-'
}

// ============ ОБРАБОТЧИКИ ДЕЙСТВИЙ ============
/**
 * Открывает форму для существующего объекта
 */
const openObjectForm = (item) => {
  console.log('[LocViewModal] Открытие объекта:', item)
  
  objectFormObjectId.value = item.objectId
  objectFormStatementId.value = null // Это объект, не запись ведомости
  objectFormInitialData.value = item
  objectFormQrCode.value = null
  
  objectFormIsOpen.value = true
}

/**
 * Обработчик сканирования QR для записи ведомости
 */
const handleQrScan = (scannedData, item) => {
  console.log('[LocViewModal] QR отсканирован для записи ведомости:', item)
  console.log('[LocViewModal] Отсканированный код:', scannedData)
  
  objectFormObjectId.value = null
  objectFormStatementId.value = item.statementId
  objectFormInitialData.value = item
  objectFormQrCode.value = scannedData
  
  objectFormIsOpen.value = true
}

const handleQrError = (error) => {
  console.error('[LocViewModal] Ошибка сканирования QR:', error)
}

// ============ ОБРАБОТЧИКИ OBJECT FORM ============
/**
 * Сохранение в ObjectFormModal
 * Если объект создан/изменён - обновляем данные в модалке
 */
const handleObjectFormSave = async (result) => {
  console.log('[LocViewModal] Результат сохранения объекта:', result)
  console.log('[LocViewModal] StatementId:', objectFormStatementId.value)
  
  // Закрываем ObjectFormModal
  objectFormIsOpen.value = false
  
  // Сбрасываем состояние формы (с задержкой, чтобы не мешать анимации закрытия)
  setTimeout(() => {
    objectFormObjectId.value = null
    objectFormStatementId.value = null
    objectFormInitialData.value = {}
    objectFormQrCode.value = null
  }, 300)
  
  // обновляем данные об объектах
 
  // Если это была запись ведомости - обновляем статус в statement
  if (objectFormStatementId.value) {
    try {
      await statementService.updateStatementHaveObject(
          objectFormStatementId.value,
          true
      )
    } catch (error) {
      console.error('[LocViewModal] Ошибка обновления ведомости:', error)
    }
  }
  // Перезагружаем данные модалки
  await loadData()
  
}

/**
 * Отмена в ObjectFormModal
 */
const handleObjectFormCancel = () => {
  console.log('[LocViewModal] Отмена создания/редактирования объекта')
  
  objectFormIsOpen.value = false
  
  setTimeout(() => {
    objectFormObjectId.value = null
    objectFormStatementId.value = null
    objectFormInitialData.value = {}
    objectFormQrCode.value = null
  }, 300)
}

/**
 * Закрытие модалки
 */
const handleClose = () => {
  console.log('[LocViewModal] Закрытие модалки')
  emit('close')
}

// ============ WATCH ============
// При открытии модалки загружаем данные
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    console.log('[LocViewModal] Модалка открыта, загружаем данные')
    await loadData()
  } else {
    // При закрытии сбрасываем состояние
    console.log('[LocViewModal] Модалка закрыта, сбрасываем состояние')
    statementRows.value = []
    objectRows.value = []
    error.value = ''
  }
}, { immediate: true })
</script>