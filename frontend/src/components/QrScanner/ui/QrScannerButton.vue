<template>
  <div class="qr-scanner-button-wrapper">
    <!-- Кнопка для открытия оверлея -->
    <button 
      class="scan-btn" 
      :class="[size, size === 'large' ? 'big-home-button' : '']"
      @click="showOverlay = true"
      title="Сканировать камерой"
    >
      <img 
        :src="currentImage" 
        alt="Сканировать камерой" 
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
import QrScannerOverlay from './QrScannerOverlay.vue'

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

// Убираем проверку камеры, всегда используем scancam режим
// Home.vue сам решает показывать кнопку или нет
const currentImage = computed(() => {
  const size = props.size === 'large' ? 'big' : 'small'
  return `/images/scancam_${size}.png` // Всегда scancam
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
/* Обертка для центрирования кнопки */
.qr-scanner-button-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

/* Кнопка сканирования */
.scan-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

/* Стиль для маленькой кнопки */
.scan-btn.small {
  padding: 0;
  max-width: 120px;
}

/* Стиль для большой кнопки (используется на Home) */
.scan-btn.large {
  padding: 0;
  max-width: 300px;
  width: 100%;
}

/* Класс для большой кнопки на главной странице */
.scan-btn.big-home-button {
  max-width: 280px;
  margin: 0 auto;
}

/* Иконка сканирования */
.scan-icon {
  height: auto;
  display: block;
  width: 100%;
}

/* Эффект при наведении */
.scan-btn:hover {
  transform: scale(1.05);
}

.scan-btn.small:hover {
  transform: scale(1.03);
}

/* Адаптивность */
@media (max-width: 768px) {
  .scan-btn.large {
    max-width: 250px;
  }
  
  .scan-btn.big-home-button {
    max-width: 220px;
  }
}

@media (max-width: 480px) {
  .scan-btn.large {
    max-width: 200px;
  }
  
  .scan-btn.big-home-button {
    max-width: 180px;
  }
}
</style>