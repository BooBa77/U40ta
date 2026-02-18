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

      <!-- 3. Местоположение (через композабл) -->
      <div class="location-section">
        <div class="form-field">
          <input
            type="text"
            v-model="places.territory"
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
            v-model="places.room"
            list="pos-list"
            placeholder="Помещение"
            class="input-field combo-input"
            :disabled="!places.territory || isSaving"
          />
          <datalist id="pos-list">
            <option v-for="pos in places.roomOptions" :key="pos" :value="pos" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="places.cabinet"
            list="cab-list"
            placeholder="Кабинет"
            class="input-field combo-input"
            :disabled="!places.room || isSaving"
          />
          <datalist id="cab-list">
            <option v-for="cab in places.cabinetOptions" :key="cab" :value="cab" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="places.user"
            list="user-list"
            placeholder="Пользователь"
            class="input-field combo-input"
            :disabled="!places.cabinet || isSaving"
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
        <div class="photos-carousel" v-if="photos.photos.length > 0">
          <div class="photo-thumb" v-for="(photo, index) in photos.photos" :key="index">
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
            <div class="table-row" v-for="(record, index) in history.history" :key="index">
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

// Композаблы
import { useAddQRcode } from '@/composables/useAddQRcode.js'
import { useObjectPlaces } from '@/composables/useObjectPlaces.js'
import { useObjectPhotos } from '@/composables/useObjectPhotos.js'
import { useObjectHistory } from '@/composables/useObjectHistory.js'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null],
  statementId: [Number, String, null],
  initialData: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'save'])

// Состояние
const isSaving = ref(false)
const errorMessage = ref('')
const comment = ref('')
// Состояние для QR-кодов
const pendingQrCodes = ref([])  // массив кодов объекта
const isScanning = ref(false)   // флаг процесса сканирования


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

// Композаблы
const qrCodeManager = useAddQRcode()
const places = useObjectPlaces(objectData.value)
const photos = useObjectPhotos()
const history = useObjectHistory()

// Методы
const addQrCode = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  
  await qrCodeManager.scanQrCode(objectData.value.id)
  // Обновляем историю после добавления QR
  await history.loadHistory(objectData.value.id)
}

const addPhoto = async () => {
  if (!objectData.value.id) {
    errorMessage.value = 'Сначала сохраните объект'
    return
  }
  
  await photos.addPhoto(objectData.value.id)
}

// Загрузка объекта по ID
const loadObject = async (id) => {
  errorMessage.value = ''
  
  try {
    const object = await objectService.getObject(id)
    
    // Заполняем данные
    objectData.value = {
      id: object.id,
      inv_number: object.inv_number || '',
      buh_name: object.buh_name || '',
      sklad: object.sklad || '',
      zavod: object.zavod || '',
      party_number: object.party_number || '',
      sn: object.sn || ''
    }
    
    // Инициализируем композаблы с данными объекта
    places.territory.value = object.place_ter || ''
    places.room.value = object.place_pos || ''
    places.cabinet.value = object.place_cab || ''
    places.user.value = object.place_user || ''
    
    // Загружаем фото и историю
    await photos.loadPhotos(id)
    await history.loadHistory(id)
    
  } catch (error) {
    errorMessage.value = `Ошибка загрузки: ${error.message}`
    console.error('Ошибка загрузки объекта:', error)
  }
}

// Сохранение объекта
const handleSave = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    // Подготавливаем данные для сохранения
    const saveData = {
      id: objectData.value.id, // null для нового объекта
      inv_number: objectData.value.inv_number,
      buh_name: objectData.value.buh_name,
      sklad: objectData.value.sklad,
      zavod: objectData.value.zavod,
      party_number: objectData.value.party_number || null,
      sn: objectData.value.sn || null,
      place_ter: places.territory.value || null,
      place_pos: places.room.value || null,
      place_cab: places.cabinet.value || null,
      place_user: places.user.value || null
    }
    
    // Сохраняем через ObjectService
    const savedObject = await objectService.saveObject(saveData)
    
    // Обновляем ID объекта (если создавали новый)
    objectData.value.id = savedObject.id
    
    // Сохраняем комментарий в историю
    if (comment.value.trim()) {
      await history.addHistoryRecord(
        'Добавлен комментарий',
        comment.value,
        savedObject.id
      )
    }
    
    // Обновляем историю на экране
    await history.loadHistory(savedObject.id)
    
    // Возвращаем результат
    emit('save', { 
      object_changed: true,
      objectId: savedObject.id 
    })
    
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
    console.error('Ошибка сохранения объекта:', error)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  emit('close', { object_changed: false })
}

const handleClose = () => {
  handleCancel()
}

// Вспомогательная функция
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

// Загрузка данных при открытии
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Сброс
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
    
    if (props.objectId) {
      // Режим редактирования существующего объекта
      await loadObject(props.objectId)
    } else if (props.initialData) {
      // Режим создания нового объекта из ведомости
      objectData.value = {
        id: null,
        inv_number: props.initialData.inv_number || '',
        buh_name: props.initialData.buh_name || '',
        sklad: props.initialData.sklad || '',
        zavod: props.initialData.zavod || '',
        party_number: props.initialData.party_number || '',
        sn: props.initialData.sn || ''
      }
      
      // Инициализируем места из initialData
      places.territory.value = props.initialData.place_ter || ''
      places.room.value = props.initialData.place_pos || ''
      places.cabinet.value = props.initialData.place_cab || ''
      places.user.value = props.initialData.place_user || ''
    }
  }
}, { immediate: true })






// Загрузка данных при открытии
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Сброс всех состояний
    resetForm()
    
    if (props.objectId) { // если передан id объекта
      // РЕЖИМ 1: Редактирование существующего объекта
      await loadObject(props.objectId)
      // Загружаем уже привязанные QR-коды
      await loadExistingQrCodes(props.objectId)
      
    } else if (props.initialData) {
      // РЕЖИМ 2: Создание нового объекта из ведомости
      initFromRowData()
      
      // СРАЗУ запускаем сканирование QR для нового объекта
      await scanInitialQrCode()
    }
  }
})

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
  errorMessage.value = ''
  pendingQrCodes.value = []  // очищаем временные QR-коды
  isScanning.value = false
  
  // Сбрасываем места
  places.territory.value = ''
  places.room.value = ''
  places.cabinet.value = ''
  places.user.value = ''
}

// Инициализация данными из строки ведомости для НОВОГО объекта
const initFromRowData = () => {
  objectData.value = {
    ...objectData.value,  // сохраняем id: null и sn: '' из resetForm
    inv_number: props.initialData.inv_number || '',
    buh_name: props.initialData.buh_name || '',
    sklad: props.initialData.sklad || '',
    zavod: props.initialData.zavod || '',
    party_number: props.initialData.party_number || ''
  }
}

// Сканирование первого QR-кода при создании
const scanInitialQrCode = async () => {
  isScanning.value = true
  
  try {
    const qrCode = await startScanning() // функция запуска камеры
    
    if (!qrCode) {
      // Пользователь закрыл сканер без результата
      handleCancel() // закрываем модалку
      return
    }
    
    // Проверяем существование кода
    const existing = await qrService.findObjectIdByQrCode(qrCode)
    
    if (existing) {
      // Код занят - спрашиваем пользователя
      const confirmed = await showConfirmDialog(existing.objectData)
      
      if (!confirmed) {
        // Пользователь отказался - закрываем модалку
        handleCancel()
        return
      }
      
      // Пользователь согласился перепривязать
      pendingQrCodes.value.push({
        code: qrCode,
        action: 'reassign',
        oldObjectId: existing.object_id
      })
      
    } else {
      // Новый код
      pendingQrCodes.value.push({
        code: qrCode,
        action: 'new'
      })
    }
    
    // Показываем пользователю, что код добавлен
    showQrAddedMessage(qrCode)
    
  } catch (error) {
    console.error('Ошибка сканирования:', error)
    // При ошибке тоже закрываем (или показываем сообщение)
    handleCancel()
  } finally {
    isScanning.value = false
  }
}

// Загрузка существующих QR-кодов объекта (для режима редактирования)
const loadExistingQrCodes = async (objectId) => {
  try {
    const codes = await qrService.getObjectQrCodes(objectId)
    // Отображаем их в интерфейсе как уже привязанные
    existingQrCodes.value = codes
  } catch (error) {
    console.error('Ошибка загрузки QR-кодов:', error)
  }
}


















</script>

<style scoped src="./ObjectFormModal.css"></style>