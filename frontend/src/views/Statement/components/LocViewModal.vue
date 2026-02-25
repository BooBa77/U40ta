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
    <div v-if="isLoading" class="loading-state">
      Загрузка данных...
    </div>

    <!-- Состояние ошибки -->
    <div v-else-if="error" class="error-state">
      {{ error }}
      <button @click="loadData" class="retry-button">Повторить</button>
    </div>

    <!-- Таблица с данными -->
    <div v-else class="table-container">
      <table class="location-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Местоположение</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in combinedItems" :key="item.id || item.statementId" class="location-row">
            <td class="number-cell">{{ index + 1 }}</td>
            <td class="location-cell">{{ getLocationDisplay(item) }}</td>
            <td class="action-cell">
              <!-- Для существующих объектов - кнопка Открыть -->
              <button 
                v-if="item.isObject" 
                @click="openObjectForm(item)"
                class="action-button open-button"
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
            <td colspan="3" class="empty-cell">
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
import { statementService } from '@/views/Statement/services/statement.service'
import { useCamera } from '@/composables/useCamera.js'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  invNumber: {
    type: String,
    required: true
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
const statementRows = ref([]) // Записи из ведомости (с have_object = false)
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
  
  // Добавляем записи из ведомости с флагом have_object = false
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
        props.zavod,
        props.sklad
      ),
      objectService.getObjectsByInv(
        props.invNumber,
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
 * place_user -> place_cab -> place_pos -> place_ter -> "-"
 */
const getLocationDisplay = (item) => {
  if (item.place_user && item.place_user.length >= 3) {
    return item.place_user
  }
  if (item.place_cab && item.place_cab.length >= 3) {
    return item.place_cab
  }
  if (item.place_pos && item.place_pos.length >= 3) {
    return item.place_pos
  }
  if (item.place_ter && item.place_ter.length >= 3) {
    return item.place_ter
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
  
  // Если объект изменился - обновляем данные
  if (result.object_changed) {
    console.log('[LocViewModal] Объект изменён, перезагружаем данные')
    
    // Если это была запись ведомости - обновляем статус в statement
    if (objectFormStatementId.value) {
      try {
        console.log('[LocViewModal] Устанавливаем have_object=true для записи:', {
          attachmentId: props.attachmentId, 
          statementId: objectFormStatementId.value
        })
        await statementService.updateStatementHaveObject(
           attachmentId,
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

<style scoped src="./LocViewModal.css"></style>