<template>
  <div>
    <!-- Кнопка для открытия оверлея -->
    <button 
      class="scan-btn" 
      :class="[size, size === 'large' ? 'big-home-button' : '']"
      @click="showOverlay = true"
      :title="titleText"
    >
      <img 
        :src="currentImage" 
        :alt="titleText" 
        class="scan-icon"
      >
    </button>
    
    <!-- Оверлей сканера -->
    <QrScannerOverlay
      v-if="showOverlay"
      :item-info="itemData"
      :is-open="showOverlay"
      @scan="handleScan"
      @close="showOverlay = false"
      @error="handleError"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import QrScannerOverlay from './QrScannerOverlay.vue' // Импортируем оверлей

const props = defineProps({
  size: {
    type: String,
    default: 'small',
    validator: (value) => ['small', 'large'].includes(value)
  },
  itemData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['scan', 'error'])

const showOverlay = ref(false)

// Реактивное определение режима (для изображения кнопки)
const canUseCamera = computed(() => {
  const isMobile = JSON.parse(localStorage.getItem('device_isMobile') || 'false')
  const hasCamera = JSON.parse(localStorage.getItem('device_hasCamera') || 'false')
  return isMobile && hasCamera
})

const titleText = computed(() => {
  return canUseCamera.value 
    ? 'Сканировать камерой' 
    : 'Открыть изображение с QR-кодом'
})

const currentImage = computed(() => {
  const mode = canUseCamera.value ? 'scancam' : 'scanfile'
  const size = props.size === 'large' ? 'big' : 'small'
  return `/images/${mode}_${size}.png`
})

// Обработчики событий от оверлея
const handleScan = (scannedData) => {
  console.log('QR сканирован через оверлей:', scannedData)
  showOverlay.value = false
  emit('scan', scannedData)
}

const handleError = (error) => {
  console.error('Ошибка сканирования:', error)
  showOverlay.value = false
  emit('error', error)
}
</script>

<style scoped>
.scan-btn.small {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;
  max-width: 120px;
}

.scan-btn.small:hover {
  transform: scale(1.05);
}

.scan-icon {
  width: 100%;
  height: auto;
  display: block;
}
</style>