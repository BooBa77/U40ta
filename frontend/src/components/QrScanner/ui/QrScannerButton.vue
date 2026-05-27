<template>
  <div class="flex justify-center items-center w-full">
    <!-- Кнопка для открытия оверлея -->
    <button 
      @click="showOverlay = true"
      :class="[
        'cursor-pointer transition-transform hover:scale-105 bg-none border-none p-0',
        sizeClass
      ]"
      :title="title"
    >
      <img 
        :src="currentImage" 
        alt="Сканировать камерой" 
        class="w-full h-auto block"
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

/**
 * @typedef {Object} Props
 * @property {'small'|'medium'|'large'} size - Размер кнопки
 * @property {Object} itemData - Данные для передачи в оверлей
 * @property {string} title - Текст подсказки при наведении
 */

const props = defineProps({
  size: {
    type: String,
    default: 'small',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  itemData: {
    type: Object,
    default: () => ({})
  },
  title: {
    type: String,
    default: 'Сканировать камерой'
  }
})

const emit = defineEmits(['scan', 'error'])

const showOverlay = ref(false)

/**
 * CSS-классы для разных размеров
 */
const sizeClass = computed(() => {
  switch (props.size) {
    case 'small':
      return 'max-w-[120px]'
    case 'medium':
      return 'max-w-[180px]'
    case 'large':
      return 'max-w-[300px] w-full'
    default:
      return 'max-w-[120px]'
  }
})

/**
 * Путь к изображению для кнопки
 */
const currentImage = computed(() => {
  const sizeMap = {
    small: 'small',
    medium: 'medium',
    large: 'big'
  }
  const sizeName = sizeMap[props.size] || 'small'
  return `/images/scancam_${sizeName}.png`
})

/**
 * Обработчик успешного сканирования
 * @param {string} scannedData - отсканированные данные
 */
const handleScan = (scannedData) => {
  console.log('QR сканирован через оверлей:', scannedData)
  showOverlay.value = false
  emit('scan', scannedData)
}

/**
 * Обработчик ошибки сканирования
 * @param {Error} error - ошибка
 */
const handleError = (error) => {
  console.error('Ошибка сканирования:', error)
  showOverlay.value = false
  emit('error', error)
}
</script>