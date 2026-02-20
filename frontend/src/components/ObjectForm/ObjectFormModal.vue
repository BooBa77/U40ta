<template>
  <BaseModal
    :is-open="isOpen"
    :show-header="false"
    :width="'100vw'"
    :max-width="'100vw'"
    @close="handleCancel"
  >
    <div class="object-form-content">
      <!-- 1. Нередактируемые данные -->
      <div class="readonly-data">
        <div class="readonly-item buh-name">{{ objectData.buh_name || '—' }}</div>
        <div class="readonly-item inv-number">{{ objectData.inv_number || '—' }}</div>
        <div class="readonly-item sklad" v-if="objectData.sklad || objectData.zavod">
          Склад - {{ objectData.sklad }}/{{ objectData.zavod }}
        </div>
      </div>

      <!-- 2. Серийный номер -->
      <div class="form-field">
        <input
          type="text"
          v-model="objectData.sn"
          placeholder="Серийный номер"
          class="input-field"
          :disabled="isSaving"
        />
      </div>

      <!-- 3. Кнопки действий -->
      <div class="actions-container">
        <div class="actions-buttons">
          <button 
            class="btn-action" 
            @click="addQrCode" 
            :disabled="isSaving"
          >
            Добавить QR-код
          </button>
        </div>
      </div>

      <!-- 4. Комментарий -->
      <div class="form-field">
        <textarea
          v-model="comment"
          placeholder="Комментарий"
          class="textarea-field"
          rows="3"
          :disabled="isSaving"
        />
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <button @click="handleCancel" class="btn btn-secondary" :disabled="isSaving">
        Отмена
      </button>
      <button @click="handleSave" class="btn btn-primary" :disabled="isSaving">
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { objectService } from '@/services/object-service.js'
import { qrService } from '@/services/qr-service.js'
import { historyService } from '@/services/history-service.js'
import { useObjectQrManager } from './composables/useObjectQrManager'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null],
  initialData: { type: Object, default: () => ({}) },
  initialQrCode: { type: String, default: null }
})

const emit = defineEmits(['save', 'cancel'])

// Состояния
const isSaving = ref(false)
const errorMessage = ref('')
const comment = ref('')

// Данные объекта
const objectData = ref({
  id: null,
  inv_number: '',
  buh_name: '',
  sklad: '',
  zavod: '',
  party_number: '',
  sn: ''
})

// QR-менеджер
const {
  pendingQrCodes,
  scanQrCode,
  saveQrCodes,
  processInitialQrCode,
  reset: resetQr
} = useObjectQrManager(objectData, {
  onCancel: () => handleCancel()  // при отказе от первого кода закрываем модалку
})

// Загрузка существующего объекта
const loadObject = async (id) => {
  try {
    const object = await objectService.getObject(id)
    objectData.value = {
      id: object.id,
      inv_number: object.inv_number || '',
      buh_name: object.buh_name || '',
      sklad: object.sklad || '',
      zavod: object.zavod || '',
      party_number: object.party_number || '',
      sn: object.sn || ''
    }
  } catch (error) {
    errorMessage.value = `Ошибка загрузки: ${error.message}`
    throw error
  }
}

// Инициализация из строки ведомости
const initFromRowData = (data) => {
  objectData.value = {
    id: null,
    inv_number: data.inv_number || '',
    buh_name: data.buh_name || '',
    sklad: data.sklad || '',
    zavod: data.zavod || '',
    party_number: data.party_number || '',
    sn: data.sn || ''
  }
}

// Сброс формы
const resetForm = () => {
  objectData.value = {
    id: null,
    inv_number: '',
    buh_name: '',
    sklad: '',
    zavod: '',
    party_number: '',
    sn: ''
  }
  comment.value = ''
  errorMessage.value = ''
  isSaving.value = false
  resetQr()
}

// Обработчики
const handleCancel = () => {
  resetForm()
  emit('cancel', { object_changed: false })
}

const addQrCode = async () => {
  await scanQrCode()  // менеджер сам всё сделает
}

const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    // 1. Сохраняем объект
    const savedObject = await objectService.saveObject(objectData.value)
    objectData.value.id = savedObject.id
    
    // 2. Привязываем QR-коды
    if (pendingQrCodes.value.length > 0) {
      await saveQrCodes(savedObject.id)
    }
    
    // 3. Записи в историю
    await historyService.addHistoryRecord(savedObject.id, 'Объект создан')
    
    if (comment.value.trim()) {
      await historyService.addHistoryRecord(savedObject.id, comment.value.trim())
    }
    
    // 4. Сообщаем родителю
    emit('save', { object_changed: true })
    
    // 5. Закрываем модалку
    resetForm()
    
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

// Открытие модалки
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    resetForm()
    
    if (props.objectId) {
      // Редактирование существующего
      await loadObject(props.objectId)
    } else {
      // Создание нового из строки ведомости
      initFromRowData(props.initialData)
      // Поступивший из ведомости QR-код передаём менеджеру как первичный
      await processInitialQrCode(props.initialQrCode)
    }
  }
}, { immediate: true })
</script>

<style scoped src="./ObjectFormModal.css"></style>