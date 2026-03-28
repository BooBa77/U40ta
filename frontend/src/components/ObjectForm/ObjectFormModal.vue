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

      <!-- 4. Кнопки действий и карусель фото -->
      <div class="media-section">
        <div class="actions-buttons-vertical">
          <button 
            v-if="hasCamera"
            class="btn-action" 
            @click="handleQrScan" 
            :disabled="isSaving"
          >
            Добавить QR-код
          </button>

          <button 
            v-if="hasCamera"
            class="btn-action" 
            @click="handlePhotoCapture" 
            :disabled="isSaving"
          >
            Добавить фото
          </button>
        </div>

        <div v-if="photos && photos.length > 0" class="photos-carousel">
          <div 
            v-for="(photo, index) in photos" 
            :key="index" 
            class="photo-thumb"
            :class="{ 'photo-deleted': photo.isDeleted }"
            @click="handlePhotoClick(index)"
          >
            <img :src="photo.min" alt="Фото" />
            <button 
              v-if="!photo.isDeleted"
              class="photo-remove" 
              @click.stop="handlePhotoDeleteClick(index)"
              :disabled="isSaving"
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
  <PhotoViewerModal
    :is-open="isPhotoViewerOpen"
    :photos="availablePhotos"
    :initial-index="photoViewerStartIndex"
    :current-sn="objectData.sn"
    @close="isPhotoViewerOpen = false"
    @update:sn="(newSn) => objectData.sn = newSn"
  />  
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { objectService } from '@/services/object-service.js'
import { qrService } from '@/services/qr-service.js'
import { useObjectPhotos } from './composables/useObjectPhotos'
import { historyService } from '@/services/history-service.js'
import { useObjectQrManager } from './composables/useObjectQrManager'
import { useCamera } from '@/composables/useCamera.js'
import { useObjectPlaces } from './composables/useObjectPlaces'
import { useObjectPhotoManager } from './composables/useObjectPhotoManager'
import { photoService } from '@/services/photo-service.js'
import PhotoViewerModal from './components/PhotoViewerModal.vue'

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
// Состояние просмотрщика
const isPhotoViewerOpen = ref(false)
const photoViewerStartIndex = ref(0)
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
// Photo-менеджер
const {
  photos,
  loadPhotos,
  addPhoto,
  toggleDeleteMark,
  savePhotosChanges,
  cleanup: resetPhotos
} = useObjectPhotos()
const { takePhoto } = useObjectPhotoManager()

// Исходные данные для отслеживания изменений
const originalData = ref({
  sn: '',
  places: ''
})

// Форматирование местоположения в строку
const formatPlacesToString = (places) => {
  const parts = [
    places.place_ter,
    places.place_pos,
    places.place_cab,
    places.place_user
  ].filter(p => p && p.trim() !== '')
  return parts.join(' / ')
}

// Захват текущих данных как "оригинал"
const captureOriginalData = () => {
  const placesForSave = getPlacesForSave()
  console.log('[captureOriginalData] getPlacesForSave():', placesForSave)
  
  const placesString = formatPlacesToString(placesForSave)
  console.log('[captureOriginalData] formatPlacesToString результат:', placesString)
  
  originalData.value = {
    sn: objectData.value.sn || '',
    places: placesString
  }
  console.log('[captureOriginalData] originalData:', originalData.value)
}

// Загрузка существующего объекта
const loadObject = async (id) => {
  try {
    const object = await objectService.getObject(id)
    objectData.value = {
      id: object.id,
      inv_number: object.inv_number || '',
      buh_name: object.buh_name || '',
      sklad: object.sklad || '',
      zavod: object.zavod || 0,
      party_number: object.party_number || '',
      sn: object.sn || ''
    }
    console.log('[loadObject] Полный объект с сервера:', JSON.stringify(object, null, 2))

    // Устанавливаем местоположение из объекта
    setPlacesFromObject(object)

    // Захватываем исходные данные ПОСЛЕ установки всех значений
    captureOriginalData()
    
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
    zavod: data.zavod || 0,
    party_number: data.party_number || '',
    sn: data.sn || ''
  }
  
  // Для нового объекта местоположение пустое, но всё равно захватываем
  captureOriginalData()
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
  resetPhotos()
}

// Обработчики
const handleCancel = () => {
  resetForm()
  emit('cancel', { was_created: false })
}

const handleQrScan = async () => {
  await scanQrCode()
}

const handlePhotoCapture = async () => {
  try {
    const blob = await takePhoto()
    addPhoto(blob)
  } catch (error) {
    if (error.message !== 'Отменено пользователем') {
      errorMessage.value = `Ошибка камеры: ${error.message}`
    }
  }
}

// Обработчик клика по крестику - только пометка на удаление
const handlePhotoDeleteClick = (index) => {
  if (isSaving.value) return
  toggleDeleteMark(index)  // ставим пометку на удаление
}

// Доступные фото (непомеченные на удаление)
const availablePhotos = computed(() => 
  photos.value.filter(p => !p.isDeleted)
)

// Обработчик клика по миниатюре
const handlePhotoClick = (index) => {
  if (isSaving.value) return
  
  const photo = photos.value[index]
  
  if (photo.isDeleted) {
    toggleDeleteMark(index)
  } else {
    // Находим индекс в отфильтрованном списке по ссылке на объект
    const availableIndex = availablePhotos.value.findIndex(p => p === photo)
    photoViewerStartIndex.value = availableIndex >= 0 ? availableIndex : 0
    isPhotoViewerOpen.value = true
  }
}

// Формирование сообщения об изменении SN
const getSnChangeMessage = () => {
  const oldSn = originalData.value.sn
  const newSn = objectData.value.sn || ''
  
  if (oldSn === newSn) return null
  if (!oldSn && newSn) return `указан s/n ${newSn}`
  if (oldSn && !newSn) return `очищен s/n`
  return `изменён s/n на ${newSn}`
}
// Формирование сообщения об изменении местоположения
const getPlacesChangeMessage = () => {
  const oldPlaces = originalData.value.places
  const newPlaces = formatPlacesToString(getPlacesForSave())
  
  if (oldPlaces === newPlaces) return null
  if (!oldPlaces && newPlaces) return `установлено на ${newPlaces}`
  if (oldPlaces && !newPlaces) return `ушло в запас`
  return `теперь у: ${newPlaces}`
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

    
    // Логируем для анализа
    console.log('=== ОТПРАВКА ОБЪЕКТА ===')
    console.log('objectData.value:', JSON.stringify(objectData.value, null, 2))
    console.log('getPlacesForSave():', getPlacesForSave())
    console.log('objectToSave (ПОЛНЫЙ):', JSON.stringify(objectToSave, null, 2))
    console.log('Поля objectToSave:', Object.keys(objectToSave))
    console.log('id в objectToSave:', objectToSave.id)
    console.log('zavod:', objectToSave.zavod, 'тип:', typeof objectToSave.zavod)
    console.log('party_number:', objectToSave.party_number, 'тип:', typeof objectToSave.party_number)
    
    // Проверяем, есть ли лишние поля
    const dtoFields = ['zavod', 'sklad', 'buh_name', 'inv_number', 'party_number', 'sn', 
                       'place_ter', 'place_pos', 'place_cab', 'place_user']
    const extraFields = Object.keys(objectToSave).filter(key => !dtoFields.includes(key))
    if (extraFields.length > 0) {
      console.warn('⚠️ ЛИШНИЕ ПОЛЯ, которых нет в DTO:', extraFields)
    }    












    // 1. Сохраняем объект
    const savedObject = await objectService.saveObject(objectToSave)
    const wasCreated = !objectData.value.id && savedObject.id
    objectData.value.id = savedObject.id
    
    // 2. Привязываем QR-коды
    console.log('[ObjectFormModal] QR-коды перед сохранением:', pendingQrCodes.value)
    console.log('[ObjectFormModal] Размер Set:', pendingQrCodes.value?.size)
    if (pendingQrCodes.value && pendingQrCodes.value.size > 0) {
      await saveQrCodes(savedObject.id)
    }
    
    // 3 Сохраняем фото

    console.log('[handleSave] Перед savePhotosChanges, photos.value:', photos.value.length)
    console.log('[handleSave] Детально о фото:', photos.value.map(p => ({
        id: p.id,
        isDeleted: p.isDeleted,
        has_raw: !!p._raw,
        has_raw_max: !!(p._raw?.max),
        raw_max_exists: !!p._raw?.max
    })))    

    await savePhotosChanges(savedObject.id)

    // 4. Записи в историю
    const historyEntries = []

    // 4a. Создание объекта (только для новых)
    if (wasCreated) {
      historyEntries.push('Объект создан')
    }

    // 4b. Изменение SN
    const snMessage = getSnChangeMessage()
    if (snMessage) historyEntries.push(snMessage)

    // 4c. Изменение местоположения
    const placesMessage = getPlacesChangeMessage()
    if (placesMessage) historyEntries.push(placesMessage)

    // 4d. Добавляем все записи по порядку
    for (const entry of historyEntries) {
      await historyService.addHistoryRecord(savedObject.id, entry)
    }

    // 4e. Комментарий (всегда отдельно и последним)
    if (comment.value.trim()) {
      await historyService.addHistoryRecord(savedObject.id, comment.value.trim())
    }

    // 4f. Обновляем checked_at, если были изменения или если это просто проверка
    const hasAnyChanges = historyEntries.length > 0 || comment.value.trim()

    if (hasAnyChanges) {
      await objectService.updateCheckedAt(savedObject.id)
    } else {
      // Ничего не менялось, добавляем запись "проверено"
      await historyService.addHistoryRecord(savedObject.id, 'проверено')
      await objectService.updateCheckedAt(savedObject.id)
    }

    // 5. Сообщаем родителю
    emit('save', { was_created: wasCreated })
    
    // 6. Закрываем модалку
    resetForm()
    
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

// Открытие модалки
watch(() => props.isOpen, async (isOpen) => {
  console.log('[ObjectFormModal] isOpen changed:', isOpen, 'objectId:', props.objectId)
  
  if (isOpen) {
    resetForm()
    
    // Загружаем комбинации местоположений (всегда, независимо от режима)
    await loadPlaceCombinations()
    
    if (props.objectId) {
      console.log('[ObjectFormModal] Редактирование существующего, objectId:', props.objectId)
      await loadObject(props.objectId)
      await loadPhotos(props.objectId)
    } else {
      console.log('[ObjectFormModal] Создание нового из initialData:', props.initialData)
      initFromRowData(props.initialData)
      await processInitialQrCode(props.initialQrCode)
    }
  }
}, { immediate: true })
</script>

<style scoped src="./ObjectFormModal.css"></style>