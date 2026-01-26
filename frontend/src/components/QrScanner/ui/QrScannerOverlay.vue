<template>
  <!-- Оверлей будет создаваться динамически через composables -->
  <!-- Этот компонент управляет логикой и передаёт данные в composables -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useQrCamera } from '../composables/useQrCamera'
import { useQrFile } from '../composables/useQrFile'

const props = defineProps({
  // Данные объекта для отображения в заголовке
  itemInfo: {
    type: Object,
    default: () => ({
      buh_name: '',
      inv_number: ''
    })
  },
  // Режим сканирования: 'camera' или 'file'
  mode: {
    type: String,
    default: 'auto', // 'auto' определяет автоматически
    validator: (value) => ['auto', 'camera', 'file'].includes(value)
  },
  // Управление видимостью
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['scan', 'close', 'error'])

// Реактивные переменные
const currentMode = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

// Определяем режим работы
const determineMode = () => {
  if (props.mode !== 'auto') {
    currentMode.value = props.mode
    return
  }
  
  // Автоматическое определение: мобилка с камерой → камера, иначе → файл
  const isMobile = JSON.parse(localStorage.getItem('device_isMobile') || 'false')
  const hasCamera = JSON.parse(localStorage.getItem('device_hasCamera') || 'false')
  
  currentMode.value = (isMobile && hasCamera) ? 'camera' : 'file'
}

// Инициализация composables
const { startCameraScan, stopCameraScan } = useQrCamera({
  onScan: (result) => {
    console.log('QR отсканирован через камеру:', result)
    emit('scan', result)
    handleClose()
  },
  onError: (error) => {
    console.error('Ошибка камеры:', error)
    errorMessage.value = error
    emit('error', error)
  },
  itemInfo: props.itemInfo
})

const { startFileScan } = useQrFile({
  onScan: (result) => {
    console.log('QR отсканирован из файла:', result)
    emit('scan', result)
    handleClose()
  },
  onError: (error) => {
    console.error('Ошибка файла:', error)
    errorMessage.value = error
    emit('error', error)
  }
})

// Запуск сканирования при открытии
const startScanning = () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    if (currentMode.value === 'camera') {
      startCameraScan()
    } else {
      startFileScan()
    }
  } catch (error) {
    errorMessage.value = `Ошибка запуска сканирования: ${error.message}`
    emit('error', error)
  } finally {
    isLoading.value = false
  }
}

// Закрытие оверлея
const handleClose = () => {
  if (currentMode.value === 'camera') {
    stopCameraScan()
  }
  emit('close')
}

// Следим за изменением isOpen
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    determineMode()
    startScanning()
  } else {
    handleClose()
  }
}, { immediate: true })

// Очистка при размонтировании
onUnmounted(() => {
  handleClose()
})
</script>

<style scoped>
.error-message {
  color: #dc2626;
  padding: 16px;
  text-align: center;
}

.loading {
  padding: 16px;
  text-align: center;
  color: #6b7280;
}
</style>