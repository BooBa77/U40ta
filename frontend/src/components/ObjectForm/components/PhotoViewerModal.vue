<template>
  <BaseModal
    :is-open="isOpen"
    :show-header="false"
    :width="'100vw'"
    :max-width="'100vw'"
    @close="handleClose"
  >
    <div class="photo-viewer">
      <!-- Кнопка закрытия -->
      <button class="close-btn" @click="handleClose">×</button>
      
      <!-- Основное фото -->
      <div class="photo-container" @click="handleNext">
        <img 
          v-if="currentPhotoUrl"
          :src="currentPhotoUrl"
          :key="currentPhotoUrl"
          class="full-photo"
          alt="Фото"
          @load="onImageLoaded"
        />
        <div v-else-if="isLoadingFullPhoto" class="loading-placeholder">
          Загрузка...
        </div>
      </div>
      
      <!-- Навигация -->
      <button 
        v-if="hasMultiplePhotos"
        class="nav-btn prev-btn" 
        @click.stop="handlePrev"
      >
        ‹
      </button>
      <button 
        v-if="hasMultiplePhotos"
        class="nav-btn next-btn" 
        @click.stop="handleNext"
      >
        ›
      </button>
      
      <!-- Поле ввода SN вместо счетчика -->
      <div class="sn-container">
        <div class="sn-wrapper">
          <label class="sn-label">Серийный номер</label>
          <div class="sn-input-group">
            <input 
              v-model="localSn"
              type="text"
              class="sn-input"
              placeholder="Введите серийный номер"
              @keyup.enter="saveAndClose"
            />
            <button 
              class="sn-ok-btn" 
              @click="saveAndClose"
              :disabled="localSn === props.currentSn"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  isOpen: Boolean,
  photos: {
    type: Array,
    required: true,
    default: () => []
  },
  initialIndex: {
    type: Number,
    default: 0
  },
  currentSn: {
    type: String,
    default: ''
  },
  // Функция для получения полноразмерного URL (передаётся из родителя)
  getFullUrl: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['close', 'update:sn'])

const currentIndex = ref(props.initialIndex)
const localSn = ref(props.currentSn)
const currentPhotoUrl = ref(null)
const isLoadingFullPhoto = ref(false)

// Хранилище для текущего ObjectURL (чтобы освобождать память)
let currentObjectUrl = null

// Освобождение текущего ObjectURL
const revokeCurrentUrl = () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

// Загрузка полноразмерного фото для текущего индекса
const loadCurrentPhoto = async () => {
  // Очищаем предыдущий URL
  revokeCurrentUrl()
  currentPhotoUrl.value = null
  
  if (!props.photos.length) return
  
  const photo = props.photos[currentIndex.value]
  if (!photo) return
  
  isLoadingFullPhoto.value = true
  
  try {
    let url = null
    
    // Приоритет 1: новое фото с камеры (есть _raw.max)
    if (photo._raw?.max) {
      url = URL.createObjectURL(photo._raw.max)
    }
    // Приоритет 2: есть метод getUrl (фото с сервера через photo-service)
    else if (typeof photo.getUrl === 'function') {
      url = await photo.getUrl()
    }
    // Приоритет 3: есть поле max (старый формат, для совместимости)
    else if (photo.max) {
      url = photo.max
    }
    
    if (url) {
      currentPhotoUrl.value = url
      currentObjectUrl = url.startsWith('blob:') ? url : null
    }
  } catch (error) {
    console.error('Ошибка загрузки фото:', error)
  } finally {
    isLoadingFullPhoto.value = false
  }
}

// Обработчик загрузки изображения
const onImageLoaded = () => {
  // Можно добавить логику при загрузке
}

const hasMultiplePhotos = computed(() => props.photos.length > 1)

// Навигация с циклическим переходом
const handlePrev = () => {
  if (!hasMultiplePhotos.value) return
  currentIndex.value = (currentIndex.value - 1 + props.photos.length) % props.photos.length
}

const handleNext = () => {
  if (!hasMultiplePhotos.value) return
  currentIndex.value = (currentIndex.value + 1) % props.photos.length
}

const saveAndClose = () => {
  if (localSn.value !== props.currentSn) {
    emit('update:sn', localSn.value)
  }
  handleClose()
}

const handleClose = () => {
  emit('close')
}

// Следим за изменением индекса — перезагружаем фото
watch(currentIndex, () => {
  loadCurrentPhoto()
})

// Следим за открытием модалки и изменением photos
watch(() => [props.isOpen, props.photos, props.initialIndex], async ([isOpen]) => {
  if (isOpen) {
    currentIndex.value = props.initialIndex
    localSn.value = props.currentSn
    await loadCurrentPhoto()
  } else {
    // При закрытии освобождаем память
    revokeCurrentUrl()
  }
}, { immediate: true })

// При уничтожении компонента освобождаем память
onBeforeUnmount(() => {
  revokeCurrentUrl()
})
</script>

<style scoped src="./PhotoViewerModal.css"></style>