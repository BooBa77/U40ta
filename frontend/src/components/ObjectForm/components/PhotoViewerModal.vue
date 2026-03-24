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
        />
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
import { ref, computed, watch } from 'vue'
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

// Вычисляем текущее фото
const currentPhoto = computed(() => {
  if (!props.photos.length) return null
  return props.photos[currentIndex.value]
})

// Получаем URL для показа
const currentPhotoUrl = computed(() => {
  if (!currentPhoto.value) return null
  
  // Для новых фото (есть _raw)
  if (currentPhoto.value._raw?.max) {
    return URL.createObjectURL(currentPhoto.value._raw.max)
  }
  
  // Для существующих фото — возвращаем путь
  return currentPhoto.value.max || null
})

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

// Сброс индекса и синхронизация SN при открытии
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentIndex.value = props.initialIndex
    localSn.value = props.currentSn
  }
})
</script>

<style scoped src="./PhotoViewerModal.css"></style>