<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" @click.self="handleCancel">
      <div class="modal-container bg-white w-full h-full flex flex-col">
        
        <!-- Контент -->
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <!-- 1. Нередактируемые данные -->
          <div class="leading-[1.3]">
            <div class="text-[15px] font-medium text-gray-800 mb-0.5">
              {{ objectData.buhName || '—' }}
            </div>
            <div class="text-sm text-gray-500 mb-0.5">
              {{ objectData.invNumber || '—' }}
            </div>
            <div 
              v-if="objectData.sklad || objectData.zavod" 
              class="text-[13px] text-gray-400"
            >
              Склад - {{ objectData.sklad }}/{{ objectData.zavod }}
            </div>
          </div>

          <!-- 2. Местоположение (4 уровня) -->
          <div class="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <!-- Территория -->
            <div>
              <input
                type="text"
                v-model="territory"
                placeholder="Территория"
                class="input-base"
                list="territory-options"
                :disabled="isSaving || placesLoading"
              />
              <datalist id="territory-options">
                <option v-for="opt in territoryOptions" :key="opt" :value="opt" />
              </datalist>
            </div>

            <!-- Здание -->
            <div>
              <input
                type="text"
                v-model="position"
                placeholder="Здание"
                class="input-base"
                list="position-options"
                :disabled="isSaving || placesLoading || !isPositionEnabled"
              />
              <datalist v-if="isPositionEnabled" id="position-options">
                <option v-for="opt in positionOptions" :key="opt" :value="opt" />
              </datalist>
            </div>

            <!-- Кабинет -->
            <div>
              <input
                type="text"
                v-model="cabinet"
                placeholder="Кабинет"
                class="input-base"
                list="cabinet-options"
                :disabled="isSaving || placesLoading || !isCabinetEnabled"
              />
              <datalist v-if="isCabinetEnabled" id="cabinet-options">
                <option v-for="opt in cabinetOptions" :key="opt" :value="opt" />
              </datalist>
            </div>

            <!-- Пользователь -->
            <div>
              <input
                type="text"
                v-model="user"
                placeholder="Пользователь"
                class="input-base"
                list="user-options"
                :disabled="isSaving || placesLoading || !isUserEnabled"
              />
              <datalist v-if="isUserEnabled" id="user-options">
                <option v-for="opt in userOptions" :key="opt" :value="opt" />
              </datalist>
            </div>

            <!-- Индикаторы -->
            <div v-if="placesLoading" class="text-[13px] text-gray-500 italic py-1">Загрузка вариантов...</div>
            <div v-if="placesError" class="text-[13px] text-red-600 py-1">{{ placesError }}</div>
          </div>

          <!-- 3. Серийный номер -->
          <div>
            <input
              type="text"
              v-model="objectData.sn"
              placeholder="Серийный номер"
              class="input-base"
              :disabled="isSaving"
            />
          </div>

          <!-- 4. Кнопки действий и карусель фото -->
          <div class="flex flex-col gap-3 min-h-[60px]">
            <div v-if="hasCamera" class="flex gap-2">
              <button 
                class="flex-1 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium
                       active:bg-blue-600 disabled:bg-blue-300"
                @click="handleQrScan" 
                :disabled="isSaving"
              >
                Добавить QR-код
              </button>
              <button 
                class="flex-1 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium
                       active:bg-blue-600 disabled:bg-blue-300"
                @click="handlePhotoCapture" 
                :disabled="isSaving"
              >
                Добавить фото
              </button>
            </div>

            <!-- Карусель -->
            <div 
              v-if="photos && photos.length > 0" 
              class="flex gap-2 overflow-x-auto py-1 items-center min-h-[70px]"
            >
              <div 
                v-for="(photo, index) in photos" 
                :key="index" 
                class="relative w-[60px] h-[60px] rounded-lg overflow-hidden shrink-0 
                       border-2 border-gray-200 bg-gray-50 active:border-blue-500"
                :class="{ 'photo-deleted': photo.isDeleted }"
                @click="handlePhotoClick(index)"
              >
                <img :src="photo.minUrl" alt="Фото" class="w-full h-full object-cover" />
                <button 
                  v-if="!photo.isDeleted"
                  class="absolute top-0.5 right-0.5 w-[22px] h-[22px] rounded-full
                         bg-red-500 text-white border-2 border-white
                         text-lg font-bold leading-none
                         flex items-center justify-center p-0
                         shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-10
                         active:bg-red-600 disabled:bg-gray-400"
                  @click.stop="handlePhotoDeleteClick(index)"
                  :disabled="isSaving"
                >
                  ×
                </button>
              </div>
            </div>
            <div v-else class="text-[13px] text-gray-400 italic py-2">Нет фото</div>
          </div>

          <!-- 5. Комментарий -->
          <div>
            <textarea
              v-model="comment"
              placeholder="Комментарий"
              class="input-base resize-y min-h-[70px] leading-relaxed"
              rows="3"
              :disabled="isSaving"
            />
          </div>

          <!-- Ошибка -->
          <div 
            v-if="errorMessage" 
            class="text-sm text-red-600 p-3 bg-red-50 rounded-lg border-l-4 border-red-600"
          >
            {{ errorMessage }}
          </div>
        </div>

        <!-- Футер -->
        <div class="flex gap-2 p-3 border-t border-gray-200 bg-white">
          <button 
            @click="handleCancel"
            class="flex-1 py-3 px-4 bg-white text-gray-700 border border-gray-300 rounded-md
                   text-base font-medium active:bg-gray-50 disabled:opacity-50"
            :disabled="isSaving"
          >
            Отмена
          </button>
          <!-- Из-за guestMode две кнопки -->
          <button 
            v-if="guestMode && !hasChanges"
            @click="handleConfirmOnly"
            class="flex-1 py-3 px-4 bg-green-500 text-white border border-green-500 rounded-md
                  text-base font-medium active:bg-green-600 disabled:opacity-50"
            :disabled="isSaving"
          >
            Подтверждаю
          </button>

          <button 
            v-else
            @click="handleSave"
            class="flex-1 py-3 px-4 bg-blue-500 text-white border border-blue-500 rounded-md
                  text-base font-medium active:bg-blue-600 disabled:opacity-50"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Сохранение...' : (guestMode ? 'Подтверждаю' : 'Подтверждаю') }}
          </button>          
        </div>

      </div>
    </div>
  </Transition>

  <PhotoViewerModal
    :is-open="isPhotoViewerOpen"
    :photos="availablePhotos"
    :initial-index="photoViewerStartIndex"
    :current-sn="objectData.sn"
    @close="isPhotoViewerOpen = false"
    @update:sn="(newSn) => objectData.sn = newSn"
  />

  <BulkMoveModal
    :is-open="isBulkMoveOpen"
    :objects="bulkMoveObjects"
    @confirm="handleBulkMoveConfirm"
    @skip="handleBulkMoveSkip"
  />
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { objectService } from '@/services/object.service'
import { logsService } from '@/services/logs.service'
import { proposedChangesService } from '@/services/proposed-changes.service'
import { useObjectPhotos } from './composables/useObjectPhotos'
import { useObjectQrCodes } from './composables/useObjectQrCodes'
import { useCamera } from '@/composables/useCamera'
import { useObjectPlaces } from './composables/useObjectPlaces'
import PhotoViewerModal from './components/PhotoViewerModal.vue'
import BulkMoveModal from './components/BulkMoveModal.vue'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null],
  initialData: { type: Object, default: () => ({}) },
  initialQrCode: { type: String, default: null },
  guestMode: { type: Boolean, default: false }
})

const emit = defineEmits(['save', 'cancel', 'guest-save', 'guest-need-auth'])

// Состояния
const isSaving = ref(false)
const errorMessage = ref('')
const comment = ref('')
const { hasCamera, takePhoto } = useCamera()
const isPhotoViewerOpen = ref(false)
const photoViewerStartIndex = ref(0)

const objectData = ref({
  id: null,
  invNumber: '',
  buhName: '',
  sklad: '',
  zavod: '',
  partyNumber: '',
  sn: ''
})

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

const {
  pendingQrCodes,
  scanQrCode,
  processInitialQrCode,
  resetQr
} = useObjectQrCodes(objectData, {
  onCancel: () => handleCancel()
})

const {
  photos,
  loadPhotos,
  addPhoto,
  toggleDeleteMark,
  prepareForSave,
  resetPhotos
} = useObjectPhotos()

const originalData = ref({
  sn: '',
  placesString: '',
  placesObject: {
    placeTer: '',
    placePos: '',
    placeCab: '',
    placeUser: ''
  }
})

// BulkMoveModal
const isBulkMoveOpen = ref(false)
const bulkMoveObjects = ref([])
let bulkMoveResolve = null

const showBulkMoveModal = (objects) => {
  return new Promise((resolve) => {
    bulkMoveObjects.value = objects
    bulkMoveResolve = resolve
    isBulkMoveOpen.value = true
  })
}

const handleBulkMoveConfirm = (selectedIds) => {
  isBulkMoveOpen.value = false
  bulkMoveResolve?.(selectedIds)
}

const handleBulkMoveSkip = () => {
  isBulkMoveOpen.value = false
  bulkMoveResolve?.([])
}

const formatPlacesToString = (places) => {
  const parts = [
    places.placeTer,
    places.placePos,
    places.placeCab,
    places.placeUser
  ].filter(p => p && p.trim() !== '')
  return parts.join(' / ')
}

const captureOriginalData = () => {
  const placesForSave = getPlacesForSave()
  
  originalData.value = {
    sn: objectData.value.sn || '',
    placesString: formatPlacesToString(placesForSave),
    placesObject: { ...placesForSave }
  }
}

const loadObject = async (id) => {
  try {
    const object = await objectService.getObject(id)
    objectData.value = {
      id: object.id,
      invNumber: object.invNumber || '',
      buhName: object.buhName || '',
      sklad: object.sklad || '',
      zavod: object.zavod || 0,
      partyNumber: object.partyNumber || '',
      sn: object.sn || ''
    }

    setPlacesFromObject(object)
    captureOriginalData()
    
  } catch (error) {
    errorMessage.value = `Ошибка загрузки: ${error.message}`
    throw error
  }
}

const initFromRowData = (data) => {
  objectData.value = {
    id: null,
    invNumber: data.invNumber || '',
    buhName: data.buhName || '',
    sklad: data.sklad || '',
    zavod: data.zavod || 0,
    partyNumber: data.partyNumber || '',
    sn: data.sn || ''
  }
  
  captureOriginalData()
}

const resetForm = () => {
  objectData.value = {
    id: null,
    invNumber: '',
    buhName: '',
    sklad: '',
    zavod: '',
    partyNumber: '',
    sn: ''
  }
  comment.value = ''
  errorMessage.value = ''
  isSaving.value = false
  resetPlaces()
  resetQr()
  resetPhotos()
}

const handleCancel = () => {
  resetForm()
  emit('cancel', { wasCreated: false })
}

const handleQrScan = async () => {
    if (props.guestMode && !localStorage.getItem('auth_token')) { // гостевой режим
    emit('guest-need-auth', 'qr', {
      places: getPlacesForSave(),
      sn: objectData.value.sn || '',
      comment: comment.value.trim()
    })
    return
  }
  await scanQrCode()
}

const handlePhotoCapture = async () => {
  if (props.guestMode && !localStorage.getItem('auth_token')) { // гостевой режим
    emit('guest-need-auth', 'photo', {
      places: getPlacesForSave(),
      sn: objectData.value.sn || '',
      comment: comment.value.trim()
    })
    return
  }
  try {
    const blob = await takePhoto()
    addPhoto(blob)
  } catch (error) {
    if (error.message !== 'Отменено пользователем') {
      errorMessage.value = `Ошибка камеры: ${error.message}`
    }
  }
}

const handlePhotoDeleteClick = (index) => {
  if (isSaving.value) return
  toggleDeleteMark(index)
}

const availablePhotos = computed(() => 
  photos.value.filter(p => !p.isDeleted)
)

const handlePhotoClick = (index) => {
  if (isSaving.value) return
  
  const photo = photos.value[index]
  
  if (photo.isDeleted) {
    toggleDeleteMark(index)
  } else {
    const availableIndex = availablePhotos.value.findIndex(p => p === photo)
    photoViewerStartIndex.value = availableIndex >= 0 ? availableIndex : 0
    isPhotoViewerOpen.value = true
  }
}

/**
 * Есть ли изменения относительно исходных данных
 */
const hasChanges = computed(() => {
  const placesChanged = getPlacesChangeMessage() !== null
  const snChanged = getSnChangeMessage() !== null
  const commentFilled = comment.value.trim() !== ''
  const photosChanged = photos.value.some(p => !p.isDeleted && !p.id) || photos.value.some(p => p.isDeleted && p.id)
  const qrChanged = pendingQrCodes.value.size > 0

  return placesChanged || snChanged || commentFilled || photosChanged || qrChanged
})

const getSnChangeMessage = () => {
  const oldSn = originalData.value.sn
  const newSn = objectData.value.sn || ''
  
  if (oldSn === newSn) return null
  if (!oldSn && newSn) return `указан s/n ${newSn}`
  if (oldSn && !newSn) return `очищен s/n`
  return `изменён s/n на ${newSn}`
}

const getPlacesChangeMessage = () => {
  const oldPlaces = originalData.value.placesString
  const newPlaces = formatPlacesToString(getPlacesForSave())
  
  if (oldPlaces === newPlaces) return null
  if (!oldPlaces && newPlaces) return `установлено на ${newPlaces}`
  if (oldPlaces && !newPlaces) return `ушло в запас`
  return `теперь у: ${newPlaces}`
}

const handleSave = async () => {
  // Гостевой режим — отдаём назад в DeepLink.vue для авторизации
  if (props.guestMode && !localStorage.getItem('auth_token')) {
    const changes = {
      places: getPlacesForSave(),
      sn: objectData.value.sn || '',
      comment: comment.value.trim()
    }
    emit('guest-save', changes)
    return
  }  
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    const objectToSave = {
      ...objectData.value,
      ...getPlacesForSave()
    }

    const { toAdd: photosToAdd, toDelete: photosToDelete } = await prepareForSave()
    const newQrCodes = Array.from(pendingQrCodes.value)

    // ---------- ОСНОВНОЙ ОБЪЕКТ ----------
    
    // Проверяем права доступа к складу
    const canEdit = await objectService.checkSkladAccess(
      objectToSave.zavod,
      objectToSave.sklad
    )

    let savedId

    if (canEdit) {
      // МОЛ — прямое сохранение
      const savedObject = await objectService.saveObject({
        objectData: objectToSave,
        qrCodes: newQrCodes,
        photosToAdd: photosToAdd,
        photosToDelete: photosToDelete
      })

      savedId = savedObject.object?.id || savedObject.id
      const wasCreated = !objectData.value.id && savedId
      objectData.value.id = savedId

      // Логи для МОЛ
      const historyEntries = []

      if (wasCreated) {
        historyEntries.push({ eventType: 'created', storyLine: 'Объект создан' })
      }

      const snMessage = getSnChangeMessage()
      if (snMessage) {
        historyEntries.push({ eventType: 'sn_changed', storyLine: snMessage })
      }

      const placesMessage = getPlacesChangeMessage()
      if (placesMessage) {
        historyEntries.push({ eventType: 'place_changed', storyLine: placesMessage })
      }

      for (const entry of historyEntries) {
        await logsService.addObjectHistory(savedId, entry.eventType, entry.storyLine)
      }

      if (comment.value.trim()) {
        await logsService.addObjectHistory(savedId, 'comment', comment.value.trim())
      }

      const hasAnyChanges = historyEntries.length > 0 || comment.value.trim()

      if (hasAnyChanges) {
        await objectService.updateCheckedAt(savedId)
      } else {
        await logsService.addObjectHistory(savedId, 'checked', 'проверено')
        await objectService.updateCheckedAt(savedId)
      }

      for (const qrCode of newQrCodes) {
        await logsService.addQrCodeHistory(qrCode, savedId)
      }

    } else {
      // Гость — предлагаемые изменения
      const proposedChanges = []

      // Местоположение
      const placesMessage = getPlacesChangeMessage()
      if (placesMessage) {
        proposedChanges.push({
          changeType: 'place',
          proposedData: getPlacesForSave()
        })
      }

      // Серийный номер
      const snMessage = getSnChangeMessage()
      if (snMessage) {
        proposedChanges.push({
          changeType: 'sn',
          proposedData: { sn: objectToSave.sn || null }
        })
      }

      // Комментарий
      if (comment.value.trim()) {
        proposedChanges.push({
          changeType: 'comment',
          proposedData: { comment: comment.value.trim() }
        })
      }

      // Новые фото
      for (const photo of photosToAdd) {
        proposedChanges.push({
          changeType: 'photo',
          proposedData: {
            photoMaxData: photo.max,
            photoMinData: photo.min
          }
        })
      }

      if (proposedChanges.length > 0) {
        await proposedChangesService.proposeChanges(objectToSave.id, proposedChanges)
      }
      
      savedId = objectToSave.id
      objectData.value.id = savedId
    }

    // ---------- СВЯЗАННЫЕ ОБЪЕКТЫ (BulkMoveModal) ----------
    
    const placesChanged = getPlacesChangeMessage() !== null

    if (placesChanged) {
      const newPlaces = getPlacesForSave()
      const oldPlaces = originalData.value.placesObject

      const allAtOldPlace = await objectService.getObjectsByPlaces(oldPlaces, savedId)

      if (allAtOldPlace.length > 0) {
        const selectedIds = await showBulkMoveModal(allAtOldPlace)

        for (const obj of allAtOldPlace) {
          if (selectedIds.includes(obj.id)) {
            const relatedCanEdit = await objectService.checkSkladAccess(
              obj.zavod,
              obj.sklad
            )

            if (relatedCanEdit) {
              await objectService.updateObject(obj.id, {
                placeTer: newPlaces.placeTer,
                placePos: newPlaces.placePos,
                placeCab: newPlaces.placeCab,
                placeUser: newPlaces.placeUser
              })

              const storyLine = `теперь у: ${formatPlacesToString(newPlaces)}`
              await logsService.addObjectHistory(obj.id, 'place_changed', storyLine)

              if (comment.value.trim()) {
                await logsService.addObjectHistory(obj.id, 'comment', comment.value.trim())
              }

              await objectService.updateCheckedAt(obj.id)

            } else {
              const relatedChanges = [{
                changeType: 'place',
                proposedData: newPlaces
              }]

              if (comment.value.trim()) {
                relatedChanges.push({
                  changeType: 'comment',
                  proposedData: { comment: comment.value.trim() }
                })
              }

              await proposedChangesService.proposeChanges(obj.id, relatedChanges)
            }
          }
        }
      }
    }
    
    const wasCreated = canEdit && !objectData.value.id
    emit('save', { wasCreated })
    resetForm()
    
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

/**
 * Гость нажал «Подтверждаю» — только updateCheckedAt
 */
const handleConfirmOnly = async () => {
  isSaving.value = true
  errorMessage.value = ''

  try {
    if (objectData.value.id) {
      await objectService.updateCheckedAt(objectData.value.id)
    }
    emit('save', { wasCreated: false })
    resetForm()
  } catch (error) {
    errorMessage.value = `Ошибка: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    resetForm()
    await loadPlaceCombinations()
    
    if (props.objectId) {
      await loadObject(props.objectId)
      // Гость не загружает существующие фото — нет токена
      if (!props.guestMode) {
        await loadPhotos(props.objectId)
      }
    } else {
      initFromRowData(props.initialData)
      await processInitialQrCode(props.initialQrCode)
    }
  }
}, { immediate: true })
</script>

<style scoped>
/* Базовые стили для input */
.input-base {
  @apply w-full px-3 py-2.5 border border-gray-300 rounded-md text-[15px] 
         bg-white disabled:bg-gray-100 disabled:text-gray-400;
}

/* Стрелка для datalist */
input[list] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

/* Перечёркивание для помеченных фото */
.photo-deleted::after {
  content: '✕';
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
         text-[32px] text-red-500 font-bold
         [text-shadow:0_0_2px_white] pointer-events-none;
}

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