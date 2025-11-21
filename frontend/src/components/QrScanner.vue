<template>
  <div class="qr-scanner" :class="size">
    <button 
      class="scan-btn" 
      @click="handleScanClick"
      title="открыть изображение с QR-кодом"
    >
      <img 
        :src="currentImage" 
        alt="открыть изображение с QR-кодом" 
        class="scan-icon"
      >
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQrScanner } from './composables/useQrScanner.js'

const props = defineProps({
  size: {
    type: String,
    default: 'small',
    validator: (value) => ['small', 'large'].includes(value)
  }
})

const emit = defineEmits(['scan', 'error'])

const currentImage = computed(() => {
  return props.size === 'small' 
    ? '/images/scan_small.png' 
    : '/images/scan_big.png'
})

const { startScan } = useQrScanner(emit)

const handleScanClick = () => { startScan() }

</script>

<style scoped>
.qr-scanner {
  display: flex;
  justify-content: center;
  align-items: center;
}

.scan-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;
}

.scan-btn:hover {
  transform: scale(1.05);
}

.scan-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Размеры */
.qr-scanner.large .scan-btn {
  max-width: 50%;
}

.qr-scanner.small .scan-btn {
  max-width: 120px;
}

.scan-icon {
  width: 100%;
  height: auto;
  display: block;
}

/* Адаптивность */
@media (max-width: 768px) {
  .qr-scanner.large .scan-btn {
    max-width: 70%;
  }
}
</style>