<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden">
      
      <!-- Кнопка закрытия -->
      <button 
        class="fixed top-5 right-5 w-11 h-11 rounded-full 
               bg-black/50 text-white text-2xl
               flex items-center justify-center
               backdrop-blur-sm z-[10001]
               active:bg-black/80"
        @click="handleClose"
      >
        ×
      </button>
      
      <!-- Контейнер фото -->
      <div 
        class="w-full h-full flex items-center justify-center touch-pan-y"
        @click="handleNext"
      >
        <img 
          v-if="currentPhotoUrl"
          :src="currentPhotoUrl"
          :key="currentPhotoUrl"
          class="max-w-full max-h-full object-contain select-none"
          alt="Фото"
          @load="onImageLoaded"
          @error="onImageError"
        />
        <div v-else-if="isLoadingFullPhoto" class="text-white/70">
          Загрузка...
        </div>
        <div v-else class="text-white/70">
          Нет фото
        </div>
      </div>
      
      <!-- Кнопки навигации -->
      <button 
        v-if="hasMultiplePhotos"
        class="fixed left-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full
               bg-black/50 text-white text-3xl
               flex items-center justify-center
               backdrop-blur-sm z-[10001]
               active:bg-black/80"
        @click.stop="handlePrev"
      >
        ‹
      </button>
      <button 
        v-if="hasMultiplePhotos"
        class="fixed right-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full
               bg-black/50 text-white text-3xl
               flex items-center justify-center
               backdrop-blur-sm z-[10001]
               active:bg-black/80"
        @click.stop="handleNext"
      >
        ›
      </button>
      
      <!-- Контейнер поля SN -->
      <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] w-[90%] max-w-[400px]">
        <div class="bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/20">
          <label class="block text-white/70 text-xs mb-1.5 tracking-wide">Серийный номер</label>
          <div class="flex gap-2.5 items-center">
            <input 
              v-model="localSn"
              type="text"
              class="flex-1 px-3 py-2.5 border border-white/30 rounded-lg
                     bg-white/15 text-white text-sm
                     placeholder:text-white/50
                     focus:border-blue-500 focus:bg-white/25"
              placeholder="Введите серийный номер"
              @keyup.enter="saveAndClose"
            />
            <button 
              class="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium
                     active:bg-blue-600
                     disabled:bg-gray-500 disabled:opacity-60"
              @click="saveAndClose"
              :disabled="localSn === props.currentSn"
            >
              OK
            </button>
          </div>
        </div>
      </div>

    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

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
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

const onImageError = (error) => {
  console.error('[PhotoViewer] Ошибка загрузки изображения:', error)
}

const onImageLoaded = () => {
  console.log('[PhotoViewer] Изображение успешно загружено')
}

const loadCurrentPhoto = async () => {
  revokeCurrentUrl()
  currentPhotoUrl.value = null
  
  if (!props.photos.length) return
  
  const photo = props.photos[currentIndex.value]
  if (!photo) return
  
  isLoadingFullPhoto.value = true

  try {
    let url = null
    
    if (photo._maxBlob) {
      url = URL.createObjectURL(photo._maxBlob)
    }
    else if (typeof photo.getFullUrl === 'function') {
      url = await photo.getFullUrl()
    }
    else if (photo.max) {
      url = photo.max
    }
    
    if (url) {
      currentPhotoUrl.value = url
      currentObjectUrl = url.startsWith('blob:') ? url : null
    }
  } catch (error) {
    console.error('[PhotoViewer] Ошибка в loadCurrentPhoto:', error)
  } finally {
    isLoadingFullPhoto.value = false
  }  
}

const hasMultiplePhotos = computed(() => props.photos.length > 1)

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

watch(currentIndex, () => {
  loadCurrentPhoto()
})

watch(() => [props.isOpen, props.photos, props.initialIndex], async ([isOpen, photos, initialIndex]) => {
  if (isOpen) {
    currentIndex.value = initialIndex
    localSn.value = props.currentSn
    await loadCurrentPhoto()
  } else {
    revokeCurrentUrl()
  }
}, { immediate: true, deep: true })

onBeforeUnmount(() => {
  revokeCurrentUrl()
})
</script>

<style scoped>
/* Только анимация, всё остальное в Tailwind */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>