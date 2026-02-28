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

      <!-- 2. Местоположение (4 уровня) -->
      <div class="places-section">
        <!-- Территория -->
        <div class="form-field">
          <input
            type="text"
            v-model="territory"
            placeholder="Территория"
            class="input-field"
            list="territory-options"
            :disabled="isSaving || placesLoading"
          />
          <datalist id="territory-options">
            <option v-for="opt in territoryOptions" :key="opt" :value="opt" />
          </datalist>
        </div>

        <!-- Помещение -->
        <div class="form-field">
          <input
            type="text"
            v-model="position"
            placeholder="Помещение"
            class="input-field"
            list="position-options"
            :disabled="isSaving || placesLoading || !isPositionEnabled"
          />
          <datalist id="position-options" v-if="isPositionEnabled">
            <option v-for="opt in positionOptions" :key="opt" :value="opt" />
          </datalist>
        </div>

        <!-- Кабинет -->
        <div class="form-field">
          <input
            type="text"
            v-model="cabinet"
            placeholder="Кабинет"
            class="input-field"
            list="cabinet-options"
            :disabled="isSaving || placesLoading || !isCabinetEnabled"
          />
          <datalist id="cabinet-options" v-if="isCabinetEnabled">
            <option v-for="opt in cabinetOptions" :key="opt" :value="opt" />
          </datalist>
        </div>

        <!-- Пользователь -->
        <div class="form-field">
          <input
            type="text"
            v-model="user"
            placeholder="Пользователь"
            class="input-field"
            list="user-options"
            :disabled="isSaving || placesLoading || !isUserEnabled"
          />
          <datalist id="user-options" v-if="isUserEnabled">
            <option v-for="opt in userOptions" :key="opt" :value="opt" />
          </datalist>
        </div>

        <!-- Индикатор загрузки местоположений -->
        <div v-if="placesLoading" class="places-loading">
          Загрузка вариантов...
        </div>
        <div v-if="placesError" class="places-error">
          {{ placesError }}
        </div>
      </div>

      <!-- 3. Серийный номер -->
      <div class="form-field">
        <input
          type="text"
          v-model="objectData.sn"
          placeholder="Серийный номер"
          class="input-field"
          :disabled="isSaving"
        />
      </div>

      <!-- 4. Кнопки действий -->
      <div class="actions-container">
        <div class="actions-buttons">
          <button 
            v-if="hasCamera"
            class="btn-action" 
            @click="addQrCode" 
            :disabled="isSaving"
          >
            Добавить QR-код
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
import { historyService } from '@/services/history-service.js'
import { useObjectQrManager } from './composables/useObjectQrManager'
import { useCamera } from '@/composables/useCamera.js'
import { useObjectPlaces } from './composables/useObjectPlaces'  // новый композабл

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
const { hasCamera } = useCamera()

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

// Местоположение
const {
  territory,
  position,
  cabinet,
  user,
  territoryOptions,
  positionOptions,
  cabinetOptions,
  userOptions,
  isPositionEnabled,
  isCabinetEnabled,
  isUserEnabled,
  isLoading: placesLoading,
  error: placesError,
  loadPlaceCombinations,
  setPlacesFromObject,
  getPlacesForSave,
  resetPlaces
} = useObjectPlaces()

// QR-менеджер
const {
  pendingQrCodes,
  scanQrCode,
  saveQrCodes,
  processInitialQrCode,
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
    
    // Устанавливаем местоположение из объекта
    setPlacesFromObject(object)
    
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
  
  // В данных ведомости нет местоположения, поэтому не устанавливаем
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
  resetPlaces()  // сбрасываем местоположение
  resetQr()
}

// Обработчики
const handleCancel = () => {
  resetForm()
  emit('cancel', { was_created: false })
}

const addQrCode = async () => {
  await scanQrCode()
}

const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    // Добавляем местоположение к данным объекта
    const objectToSave = {
      ...objectData.value,
      ...getPlacesForSave()
    }
    
    // 1. Сохраняем объект
    const savedObject = await objectService.saveObject(objectToSave)
    const wasCreated = !objectData.value.id && savedObject.id
    objectData.value.id = savedObject.id
    
    // 2. Привязываем QR-коды
    if (pendingQrCodes.value.length > 0) {
      await saveQrCodes(savedObject.id)
    }
    
    // 3. Записи в историю
    await historyService.addHistoryRecord(
      savedObject.id, 
      wasCreated ? 'Объект создан' : 'Объект изменён'
    )
    
    if (comment.value.trim()) {
      await historyService.addHistoryRecord(savedObject.id, comment.value.trim())
    }
    
    // 4. Сообщаем родителю
    emit('save', { was_created: wasCreated })
    
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
    
    // Загружаем комбинации местоположений (всегда, независимо от режима)
    await loadPlaceCombinations()
    
    if (props.objectId) {
      // Редактирование существующего
      await loadObject(props.objectId)
    } else {
      // Создание нового из строки ведомости
      initFromRowData(props.initialData)
      await processInitialQrCode(props.initialQrCode)
    }
  }
}, { immediate: true })
</script>

<style scoped src="./ObjectFormModal.css"></style>