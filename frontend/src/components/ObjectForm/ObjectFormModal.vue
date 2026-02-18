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

      <!-- 3. Местоположение -->
      <div class="location-section">
        <div class="form-field">
          <input
            type="text"
            v-model="places.territory.value"
            list="ter-list"
            placeholder="Территория"
            class="input-field combo-input"
            :disabled="isSaving"
          />
          <datalist id="ter-list">
            <option v-for="ter in places.territoryOptions" :key="ter" :value="ter" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="places.room.value"
            list="pos-list"
            placeholder="Помещение"
            class="input-field combo-input"
            :disabled="!places.territory.value || isSaving"
          />
          <datalist id="pos-list">
            <option v-for="pos in places.roomOptions" :key="pos" :value="pos" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="places.cabinet.value"
            list="cab-list"
            placeholder="Кабинет"
            class="input-field combo-input"
            :disabled="!places.room.value || isSaving"
          />
          <datalist id="cab-list">
            <option v-for="cab in places.cabinetOptions" :key="cab" :value="cab" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="places.user.value"
            list="user-list"
            placeholder="Пользователь"
            class="input-field combo-input"
            :disabled="!places.cabinet.value || isSaving"
          />
          <datalist id="user-list">
            <option v-for="user in places.userOptions" :key="user" :value="user" />
          </datalist>
        </div>
      </div>

      <!-- 4. Строка действий -->
      <div class="actions-container">
        <div class="actions-buttons">
          <button class="btn-action" @click="addQrCode" :disabled="isSaving || !objectData.id">
            Добавить QR-код
          </button>
          <button class="btn-action" @click="addPhoto" :disabled="isSaving || !objectData.id">
            Добавить фото
          </button>
        </div>
        
        <!-- Карусель фото -->
        <div class="photos-carousel" v-if="photos.photos.value.length > 0">
          <div class="photo-thumb" v-for="(photo, index) in photos.photos.value" :key="index">
            <img :src="photo.thumbUrl || photo.url" alt="Фото" />
            <button 
              v-if="!isSaving"
              class="photo-remove-btn"
              @click="photos.removePhoto(index)"
              type="button"
              title="Удалить фото"
            >
              ×
            </button>
          </div>
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

      <!-- 6. История изменений -->
      <div class="history-section">
        <div class="history-table">
          <div class="table-header">
            <div class="table-col">Дата</div>
            <div class="table-col">Пользователь</div>
            <div class="table-col">Действие</div>
          </div>
          <div class="table-body">
            <div class="table-row" v-for="(record, index) in history.history.value" :key="index">
              <div class="table-col">{{ formatDate(record.created_at) }}</div>
              <div class="table-col">{{ record.user_name }}</div>
              <div class="table-col">{{ record.action }}</div>
            </div>
          </div>
        </div>
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

// Локальные композаблы
import { useObjectFormLifecycle } from './composables/useObjectFormLifecycle'
import { useObjectPlaces } from './composables/useObjectPlaces'
import { useObjectPhotos } from './composables/useObjectPhotos'
import { useObjectQrManager } from './composables/useObjectQrManager'
import { useObjectHistory } from '@/composables/useObjectHistory'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null],
  initialData: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'save'])

// 1. ЖИЗНЕННЫЙ ЦИКЛ
const {
  isSaving,
  errorMessage,
  comment,
  objectData,
  loadObject,
  initFromRowData,
  resetForm,
  prepareSaveData
} = useObjectFormLifecycle(props, emit)

// 2. МЕСТОПОЛОЖЕНИЕ
const places = useObjectPlaces()

// 3. ФОТО
const photos = useObjectPhotos()

// 4. QR-МЕНЕДЖЕР
const handleCancel = () => {
  resetForm()
  places.reset()
  resetQr()  // очищаем QR-менеджер
  emit('close', { object_changed: false })
}

const handleClose = () => handleCancel()

const {
  pendingQrCodes,
  isScanning,
  scanQrCode,
  saveQrCodes,
  reset: resetQr
} = useObjectQrManager(objectData, {
  onCancel: handleClose    // если отказались от ввода первого кода, выход без сохранений
})

// Методы
const addQrCode = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  await scanQrCode()  // дополнительный код (isFirst = false по умолчанию)
}

// 5. ИСТОРИЯ (глобальный)
const history = useObjectHistory()

// Методы (раскидать)
const addPhoto = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  await photos.addPhoto(objectData.value.id)
}

const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    const saveData = {
      ...objectData.value,
      place_ter: places.territory.value,
      place_pos: places.room.value,
      place_cab: places.cabinet.value,
      place_user: places.user.value
    }
    
    // 1. Сохраняем объект
    const savedObject = await objectService.saveObject(saveData)
    objectData.value.id = savedObject.id
    
    // 2. Привязываем QR-коды
    if (pendingQrCodes.value.length > 0) {
      await saveQrCodes(savedObject.id)
    }
    
    // 3. Комментарий в историю
    if (comment.value.trim()) {
      await history.addHistoryRecord('Добавлен комментарий', comment.value, savedObject.id)
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

const formatDate = (dateString) => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

// Загрузка при открытии
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    resetForm()
    places.reset()
    resetQr()
    
    if (props.objectId) {
      const object = await loadObject(props.objectId)
      places.initFromObject(object)
      await photos.loadPhotos(props.objectId)
    } else {
      initFromRowData(props.initialData)
      await scanQrCode({ isFirst: true })  // ПЕРВЫЙ код
    }
  }
}, { immediate: true })
</script>

<style scoped src="./ObjectFormModal.css"></style>