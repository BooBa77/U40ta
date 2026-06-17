<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" style="width: 600px; max-width: 90vw; max-height: 85vh;">
        
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">{{ modalTitle }}</h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                   active:bg-gray-100 active:text-gray-900"
            @click="handleClose"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="overflow-y-auto flex-1 p-5">
          <!-- Состояние загрузки -->
          <div v-if="isLoading" class="py-10 text-center text-gray-500">
            Загрузка данных...
          </div>

          <!-- Состояние ошибки -->
          <div v-else-if="error" class="py-10 text-center text-red-600">
            {{ error }}
            <button 
              @click="loadData" 
              class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium
                     active:bg-red-600"
            >
              Повторить
            </button>
          </div>

          <!-- Таблица с данными -->
          <div v-else class="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 w-[50px] text-center">
                    №
                  </th>
                  <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200">
                    Местоположение
                  </th>
                  <th class="sticky top-0 z-10 bg-gray-50 px-3 py-3 text-right font-semibold text-gray-800 border-b-2 border-gray-200 w-[100px]">
                    Действие
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(item, index) in combinedItems" 
                  :key="item.id || item.statementId" 
                  class="active:bg-gray-50"
                >
                  <td class="px-2 py-2.5 border-b border-gray-100 text-center text-gray-500 font-medium">
                    {{ index + 1 }}
                  </td>
                  <td class="px-2 py-2.5 border-b border-gray-100 text-gray-600">
                    {{ getLocationDisplay(item) }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-gray-100 text-right">
                    <!-- Для существующих объектов - кнопка Открыть -->
                    <button 
                      v-if="item.isObject" 
                      @click="openObjectForm(item)"
                      class="px-3 py-1.5 bg-blue-500 text-white border border-blue-600 rounded-md text-xs font-medium
                             active:bg-blue-600"
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
                  <td colspan="3" class="text-center py-10 text-gray-400 italic">
                    Нет данных для отображения
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </Transition>

  <!-- Вложенная модалка ObjectForm -->
  <ObjectFormModal
    :is-open="objectFormIsOpen"
    :object-id="objectFormObjectId"
    :initial-data="objectFormInitialData"
    :initial-qr-code="objectFormQrCode"
    @save="handleObjectFormSave"
    @cancel="handleObjectFormCancel"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
const statementRows = ref([])
const objectRows = ref([])
const { hasCamera } = useCamera()

const objectFormIsOpen = ref(false)
const objectFormObjectId = ref(null)
const objectFormStatementId = ref(null)
const objectFormInitialData = ref({})
const objectFormQrCode = ref(null)

// ============ COMPUTED ============
const modalTitle = computed(() => {
  return `Инв. № ${props.invNumber} / Склад ${props.sklad}`
})

const combinedItems = computed(() => {
  const items = []
  
  statementRows.value.forEach(row => {
    items.push({
      ...row,
      isObject: false,
      statementId: row.id
    })
  })
  
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
const loadData = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
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
    
    statementRows.value = statements
    objectRows.value = objects
    
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить данные'
  } finally {
    isLoading.value = false
  }
}

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
const openObjectForm = (item) => {
  objectFormObjectId.value = item.objectId
  objectFormStatementId.value = null
  objectFormInitialData.value = item
  objectFormQrCode.value = null
  
  objectFormIsOpen.value = true
}

const handleQrScan = (scannedData, item) => {
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
const handleObjectFormSave = async (result) => {
  objectFormIsOpen.value = false
  
  setTimeout(() => {
    objectFormObjectId.value = null
    objectFormStatementId.value = null
    objectFormInitialData.value = {}
    objectFormQrCode.value = null
  }, 300)
  
  // haveObject вычисляется динамически на бэке,
  // просто перезагружаем данные
  await loadData()
}

const handleObjectFormCancel = () => {
  objectFormIsOpen.value = false
  
  setTimeout(() => {
    objectFormObjectId.value = null
    objectFormStatementId.value = null
    objectFormInitialData.value = {}
    objectFormQrCode.value = null
  }, 300)
}

const handleClose = () => {
  emit('close')
}

// ============ WATCH ============
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    await loadData()
  } else {
    statementRows.value = []
    objectRows.value = []
    error.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
/* Анимация появления/исчезновения модалки */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-5px);
}
</style>