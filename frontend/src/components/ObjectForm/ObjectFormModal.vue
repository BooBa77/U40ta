<template>
  <BaseModal
    :is-open="isOpen"
    :show-header="false"
    :width="'100vw'"
    :max-width="'100vw'"
    @close="handleClose"
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

      <!-- 3. Местоположение (заглушка) -->
      <div class="location-section">
        <div class="form-field">
          <input
            type="text"
            v-model="places.territory"
            placeholder="Территория"
            class="input-field"
            :disabled="isSaving"
          />
        </div>
        <div class="form-field">
          <input
            type="text"
            v-model="places.room"
            placeholder="Помещение"
            class="input-field"
            :disabled="isSaving"
          />
        </div>
        <div class="form-field">
          <input
            type="text"
            v-model="places.cabinet"
            placeholder="Кабинет"
            class="input-field"
            :disabled="isSaving"
          />
        </div>
        <div class="form-field">
          <input
            type="text"
            v-model="places.user"
            placeholder="Пользователь"
            class="input-field"
            :disabled="isSaving"
          />
        </div>
      </div>

      <!-- 4. Кнопки действий -->
      <div class="actions-container">
        <div class="actions-buttons">
          <button class="btn-action" @click="addQrCode" :disabled="isSaving || !objectData.id">
            Добавить QR-код
          </button>
          <button class="btn-action" @click="addPhoto" :disabled="isSaving || !objectData.id">
            Добавить фото
          </button>
        </div>
      </div>

      <!-- 5. Комментарий -->
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
import { useObjectFormLifecycle } from './composables/useObjectFormLifecycle'
import { useObjectQrManager } from './composables/useObjectQrManager'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null],
  initialData: { type: Object, default: () => ({}) },
  initialQrCode: { type: String, default: null }
})

const emit = defineEmits(['close', 'save'])

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

// Местоположение (временные простые поля)
const places = ref({
  territory: '',
  room: '',
  cabinet: '',
  user: ''
})

// QR-менеджер
const {
  pendingQrCodes,
  isScanning,
  scanQrCode,
  saveQrCodes,
  reset: resetQr
} = useObjectQrManager(objectData, {
  onCancel: () => handleCancel()
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
    places.value = {
      territory: object.place_ter || '',
      room: object.place_pos || '',
      cabinet: object.place_cab || '',
      user: object.place_user || ''
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
  places.value = {
    territory: '',
    room: '',
    cabinet: '',
    user: ''
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

const handleClose = () => handleCancel()

const addQrCode = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  await scanQrCode()
}

const addPhoto = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  // Заглушка для фото
  console.log('Добавление фото для объекта', objectData.value.id)
}

const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    const saveData = {
      ...objectData.value,
      place_ter: places.value.territory || null,
      place_pos: places.value.room || null,
      place_cab: places.value.cabinet || null,
      place_user: places.value.user || null
    }
    
    // Сохраняем объект
    const savedObject = await objectService.saveObject(saveData)
    objectData.value.id = savedObject.id
    
    // Привязываем QR-коды
    if (pendingQrCodes.value.length > 0) {
      await saveQrCodes(savedObject.id)
    }
    
    emit('save', { 
      object_changed: true,
      objectId: savedObject.id 
    })
    
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
      
      // Обрабатываем переданный QR-код
      if (props.initialQrCode) {
        try {
          const existing = await qrService.findObjectIdByQrCode(props.initialQrCode)
          
          if (existing?.object_id) {
            const confirmReassign = confirm(
              `QR-код "${props.initialQrCode}" уже привязан к другому объекту.\nПерепривязать к новому объекту?`
            )
            
            if (!confirmReassign) {
              handleCancel()
              return
            }
          }
          
          pendingQrCodes.value.push(props.initialQrCode)
          console.log('Код добавлен в очередь:', props.initialQrCode)
          
        } catch (error) {
          console.error('Ошибка проверки QR-кода:', error)
          pendingQrCodes.value.push(props.initialQrCode)
        }
      }
    }
  }
}, { immediate: true })
</script>

<style scoped src="./ObjectFormModal.css"></style>