<template>
  <BaseModal
    :is-open="isOpen"
    :show-header="false"
    :width="'100vw'"
    :max-width="'100vw'"
    @close="handleClose"
  >
    <div class="photo-viewer">
      <button class="close-btn" @click="handleClose">×</button>
      
      <div class="photo-container" @click="handleNext">
        <img 
          v-if="currentPhotoUrl"
          :src="currentPhotoUrl"
          :key="currentPhotoUrl"
          class="full-photo"
          alt="Фото"
          @load="onImageLoaded"
          @error="onImageError"
        />
        <div v-else-if="isLoadingFullPhoto" class="loading-placeholder">
          Загрузка...
        </div>
        <div v-else class="loading-placeholder">
          Нет фото
        </div>
      </div>
      
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
  }
})

const emit = defineEmits(['close', 'update:sn'])

const currentIndex = ref(props.initialIndex)
const localSn = ref(props.currentSn)
const currentPhotoUrl = ref(null)
const isLoadingFullPhoto = ref(false)

let currentObjectUrl = null

const revokeCurrentUrl = () => {
  if (currentObjectUrl) {
    console.log('[PhotoViewer] revoke URL:', currentObjectUrl)
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

const onImageError = (error) => {
  console.error('[PhotoViewer] Ошибка загрузки изображения:', error)
  console.log('[PhotoViewer] currentPhotoUrl:', currentPhotoUrl.value)
}

const onImageLoaded = () => {
  console.log('[PhotoViewer] Изображение успешно загружено')
}

const loadCurrentPhoto = async () => {
  console.log('[PhotoViewer] loadCurrentPhoto START')
  console.log('[PhotoViewer] photos.length:', props.photos.length)
  console.log('[PhotoViewer] currentIndex:', currentIndex.value)
  
  revokeCurrentUrl()
  currentPhotoUrl.value = null
  
  if (!props.photos.length) {
    console.log('[PhotoViewer] Нет фото, выхожу')
    return
  }
  
  const photo = props.photos[currentIndex.value]
  console.log('[PhotoViewer] photo object:', photo)
  console.log('[PhotoViewer] photo keys:', Object.keys(photo))
  
  if (!photo) {
    console.log('[PhotoViewer] photo не найден, выхожу')
    return
  }
  
  isLoadingFullPhoto.value = true

  try {
    let url = null
    
    // Новое фото с камеры (ещё не сохранённое на сервере)
    // У таких фото есть поле _maxBlob с Blob'ом полноразмерного изображения
    if (photo._maxBlob) {
      console.log('[PhotoViewer] Ветка: новое фото с камеры, создаю ObjectURL из _maxBlob')
      url = URL.createObjectURL(photo._maxBlob)
      console.log('[PhotoViewer] Создан ObjectURL:', url)
    }
    // Фото с сервера или из кэша — используем единый интерфейс getFullUrl
    else if (typeof photo.getFullUrl === 'function') {
      console.log('[PhotoViewer] Ветка: вызов getFullUrl()')
      url = await photo.getFullUrl()
      console.log('[PhotoViewer] getFullUrl() вернул:', url)
    }
    // Fallback для старых форматов (на всякий случай)
    else if (photo.max) {
      console.log('[PhotoViewer] Ветка: fallback, photo.max:', photo.max)
      url = photo.max
    }
    else {
      console.log('[PhotoViewer] Нет подходящего источника для фото')
      console.log('[PhotoViewer] Доступные поля:', Object.keys(photo))
    }
    
    if (url) {
      currentPhotoUrl.value = url
      // Запоминаем только blob URL, чтобы потом освободить
      currentObjectUrl = url.startsWith('blob:') ? url : null
      console.log('[PhotoViewer] currentPhotoUrl установлен:', currentPhotoUrl.value)
    } else {
      console.log('[PhotoViewer] url пустой, фото не будет отображаться')
    }
  } catch (error) {
    console.error('[PhotoViewer] Ошибка в loadCurrentPhoto:', error)
  } finally {
    isLoadingFullPhoto.value = false
    console.log('[PhotoViewer] loadCurrentPhoto END')
  }  
}

const hasMultiplePhotos = computed(() => props.photos.length > 1)

const handlePrev = () => {
  if (!hasMultiplePhotos.value) return
  currentIndex.value = (currentIndex.value - 1 + props.photos.length) % props.photos.length
  console.log('[PhotoViewer] handlePrev, новый индекс:', currentIndex.value)
}

const handleNext = () => {
  if (!hasMultiplePhotos.value) return
  currentIndex.value = (currentIndex.value + 1) % props.photos.length
  console.log('[PhotoViewer] handleNext, новый индекс:', currentIndex.value)
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

watch(currentIndex, () => {
  console.log('[PhotoViewer] watch currentIndex, загружаем фото')
  loadCurrentPhoto()
})

watch(() => [props.isOpen, props.photos, props.initialIndex], async ([isOpen, photos, initialIndex]) => {
  console.log('[PhotoViewer] watch props изменился')
  console.log('[PhotoViewer] isOpen:', isOpen)
  console.log('[PhotoViewer] photos.length:', photos?.length)
  console.log('[PhotoViewer] initialIndex:', initialIndex)
  
  if (isOpen) {
    currentIndex.value = initialIndex
    localSn.value = props.currentSn
    await loadCurrentPhoto()
  } else {
    revokeCurrentUrl()
  }
}, { immediate: true, deep: true })

onBeforeUnmount(() => {
  console.log('[PhotoViewer] onBeforeUnmount, очищаю')
  revokeCurrentUrl()
})
</script>

<style scoped src="./PhotoViewerModal.css"></style>