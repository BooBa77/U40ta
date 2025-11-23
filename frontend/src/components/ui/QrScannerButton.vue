<template>
  <button 
    class="scan-btn" 
    :class="[size, size === 'large' ? 'big-home-button' : '']"
    @click="handleScanClick"
    :title="titleText"
  >
    <img 
      :src="currentImage" 
      :alt="titleText" 
      class="scan-icon"
    >
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useQrScanner } from '../composables/useQrScanner.js'

const props = defineProps({
  size: {
    type: String,
    default: 'small',
    validator: (value) => ['small', 'large'].includes(value)
  }
})

const emit = defineEmits(['scan', 'error'])

// Реактивное определение режима
const canUseCamera = computed(() => {
  const isMobile = JSON.parse(localStorage.getItem('device_isMobile') || 'false')
  const hasCamera = JSON.parse(localStorage.getItem('device_hasCamera') || 'false')
  return isMobile && hasCamera
})

// Реактивный заголовок (для title и alt)
const titleText = computed(() => {
  return canUseCamera.value 
    ? 'Сканировать камерой' 
    : 'Открыть изображение с QR-кодом'
})

// Реактивное изображение
const currentImage = computed(() => {
  const mode = canUseCamera.value ? 'scancam' : 'scanfile'
  const size = props.size === 'large' ? 'big' : 'small'
  return `/images/${mode}_${size}.png`
})

const { startScan } = useQrScanner(emit)

const handleScanClick = () => {
  startScan()
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