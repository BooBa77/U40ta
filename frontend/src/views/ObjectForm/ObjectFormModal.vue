<template>
  <BaseModal
    :is-open="isOpen"
    :title="modalTitle"
    :width="'600px'"
    :max-width="'90vw'"
    @close="handleClose"
  >
    <!-- Загрузка -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка данных...</p>
    </div>
    
    <!-- Основная форма -->
    <div v-else class="object-form-content">
      <!-- Сообщение о перепривязке -->
      <div v-if="reassignWarning" class="warning-message">
        <h4>⚠️ Внимание: QR-код уже привязан</h4>
        <p>Код <strong>{{ qrCode }}</strong> уже привязан к объекту:</p>
        <div class="existing-object-info">
          <p>Инв. номер: <strong>{{ reassignWarning.inv_number }}</strong></p>
          <p>Наименование: <strong>{{ reassignWarning.buh_name }}</strong></p>
          <p>Склад: <strong>{{ reassignWarning.zavod }}/{{ reassignWarning.sklad }}</strong></p>
        </div>
        <p class="warning-text">Перепривязать QR-код к новому объекту?</p>
      </div>
      
      <!-- Блок 1: Основная информация (readonly) -->
      <div class="form-section">
        <h3 class="section-title">Основная информация</h3>
        
        <!-- Инвентарный номер -->
        <div class="form-field">
          <label class="field-label">Инвентарный номер</label>
          <div class="static-field">{{ formData.inv_number || '—' }}</div>
        </div>
        
        <!-- Наименование -->
        <div class="form-field">
          <label class="field-label">Наименование</label>
          <div class="static-field">{{ formData.buh_name || '—' }}</div>
        </div>
        
        <!-- Склад/Завод -->
        <div class="form-field">
          <label class="field-label">Склад</label>
          <div class="static-field" v-if="formData.zavod && formData.sklad">
            {{ formData.zavod }}/{{ formData.sklad }}
          </div>
          <div class="static-field" v-else>—</div>
        </div>
      </div>
      
      <!-- Блок 2: Редактируемые поля -->
      <div class="form-section">
        <h3 class="section-title">Дополнительная информация</h3>
        
        <!-- Серийный номер -->
        <div class="form-field">
          <label class="field-label">Серийный номер</label>
          <input
            type="text"
            v-model="formData.sn"
            placeholder="Введите серийный номер"
            class="input-field"
          />
        </div>
      </div>
      
      <!-- Блок 3: QR-коды -->
      <div class="form-section">
        <div class="section-header">
          <h3 class="section-title">QR-коды</h3>
          <button 
            @click="addQrCode" 
            class="add-qr-btn"
            type="button"
          >
            + Добавить QR-код
          </button>
        </div>
        
        <!-- Основной QR (если передан) -->
        <div v-if="qrCode" class="form-field">
          <label class="field-label">Основной QR-код</label>
          <div class="qr-code-display">
            <code>{{ qrCode }}</code>
            <span class="qr-source">(отсканирован)</span>
          </div>
        </div>
        
        <!-- Существующие QR-коды -->
        <div v-if="existingQrCodes.length > 0" class="existing-qr-section">
          <label class="field-label">Существующие QR-коды</label>
          <div class="qr-codes-list">
            <div v-for="qr in existingQrCodes" :key="qr" class="qr-code-item">
              <code>{{ qr }}</code>
              <button 
                @click="removeQrCode(qr)" 
                class="remove-qr-btn"
                title="Удалить"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        
        <!-- Новые QR-коды -->
        <div v-if="newQrCodes.length > 0" class="new-qr-section">
          <label class="field-label">Новые QR-коды</label>
          <div class="qr-codes-list">
            <div v-for="(qr, index) in newQrCodes" :key="index" class="qr-code-item new">
              <code>{{ qr }}</code>
              <button 
                @click="removeNewQrCode(index)" 
                class="remove-qr-btn"
                title="Удалить"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Сообщение об ошибке -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
    
    <!-- Футер с кнопками -->
    <template #footer>
      <button @click="handleCancel" class="btn btn-secondary">
        Отмена
      </button>
      <button 
        @click="handleSave" 
        class="btn btn-primary"
        :disabled="isSaving"
      >
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { qrService } from '@/components/QrScanner/services/qr.service'
import { objectService } from './services/ObjectService'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'reassign', 'edit'].includes(value)
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  qrCode: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['save', 'cancel'])

// Реактивное состояние
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')

// Данные формы
const formData = ref({
  inv_number: '',
  buh_name: '',
  sklad: '',
  zavod: '',
  party_number: '',
  sn: ''
})

// QR-коды
const existingQrCodes = ref([])
const newQrCodes = ref([])
const reassignWarning = ref(null)

// Заголовок модалки
const modalTitle = computed(() => {
  const titles = {
    create: 'Создание нового объекта',
    reassign: 'Перепривязка QR-кода',
    edit: 'Редактирование объекта'
  }
  return titles[props.mode] || 'Объект учёта'
})

// Загрузка начальных данных
const loadInitialData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    // 1. Заполняем форму из initialData
    formData.value = {
      inv_number: props.initialData.inv_number || '',
      buh_name: props.initialData.buh_name || '',
      sklad: props.initialData.sklad || '',
      zavod: props.initialData.zavod || '',
      party_number: props.initialData.party_number || '',
      sn: props.initialData.sn || ''
    }
    
    // 2. Если передан QR-код, проверяем его
    if (props.qrCode) {
      await checkQrCode(props.qrCode)
    }
    
    // 3. Если режим edit, загружаем существующие QR-коды
    if (props.mode === 'edit' && props.initialData.id) {
      await loadExistingQrCodes(props.initialData.id)
    }
    
  } catch (error) {
    errorMessage.value = `Ошибка загрузки: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

// Проверка QR-кода
const checkQrCode = async (qrValue) => {
  try {
    const result = await qrService.getQrCodeWithObject(qrValue)
    
    if (result) {
      // QR существует, показываем предупреждение
      reassignWarning.value = {
        inv_number: result.objectData.inv_number,
        buh_name: result.objectData.buh_name,
        sklad: result.objectData.sklad,
        zavod: result.objectData.zavod
      }
    }
  } catch (error) {
    console.error('Ошибка проверки QR:', error)
  }
}

// Загрузка существующих QR-кодов объекта
const loadExistingQrCodes = async (objectId) => {
  // TODO: Реализовать метод в qrService для получения QR-кодов объекта
  // existingQrCodes.value = await qrService.getObjectQrCodes(objectId)
}

// Добавление нового QR-кода
const addQrCode = () => {
  // TODO: Открыть QrScanner оверлей для сканирования
  // После сканирования добавить в newQrCodes
  console.log('Добавление QR-кода...')
  
  // Временная заглушка
  const newCode = prompt('Введите QR-код вручную (временная функция)')
  if (newCode && !newQrCodes.value.includes(newCode)) {
    newQrCodes.value.push(newCode)
  }
}

// Удаление существующего QR
const removeQrCode = (qr) => {
  if (confirm(`Удалить QR-код ${qr}?`)) {
    existingQrCodes.value = existingQrCodes.value.filter(code => code !== qr)
  }
}

// Удаление нового QR
const removeNewQrCode = (index) => {
  newQrCodes.value.splice(index, 1)
}

// Сохранение
const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    // Валидация
    if (!formData.value.inv_number) {
      throw new Error('Инвентарный номер обязателен')
    }
    
    // Подготовка данных
    const saveData = {
      ...formData.value,
      // Все QR-коды: существующие + новые + основной (если есть)
      qr_codes: [
        ...existingQrCodes.value,
        ...newQrCodes.value,
        ...(props.qrCode ? [props.qrCode] : [])
      ].filter(Boolean)
    }
    
    // Сохранение в зависимости от режима
    let result
    if (props.mode === 'create' || props.mode === 'reassign') {
      result = await createObject(saveData)
    } else if (props.mode === 'edit') {
      result = await updateObject(saveData)
    }
    
    // Успех
    emit('save', result)
    
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

// Создание объекта
const createObject = async (data) => {
  // TODO: Реализовать в objectService.createObject()
  // + привязка QR-кодов через qrService
  console.log('Создание объекта:', data)
  
  // Заглушка
  return { success: true, objectId: Date.now() }
}

// Обновление объекта
const updateObject = async (data) => {
  // TODO: Реализовать в objectService.updateObject()
  console.log('Обновление объекта:', data)
  
  // Заглушка
  return { success: true }
}

// Отмена
const handleCancel = () => {
  emit('cancel')
}

// Закрытие
const handleClose = () => {
  emit('cancel')
}

// Наблюдаем за открытием модалки
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadInitialData()
  } else {
    // Сброс состояния при закрытии
    formData.value = {
      inv_number: '',
      buh_name: '',
      sklad: '',
      zavod: '',
      party_number: '',
      sn: ''
    }
    existingQrCodes.value = []
    newQrCodes.value = []
    reassignWarning.value = null
    errorMessage.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
@import './ObjectFormModal.css';
</style>