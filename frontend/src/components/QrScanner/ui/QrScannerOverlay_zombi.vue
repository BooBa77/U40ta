<template>
  <!-- Оверлей будет создаваться динамически через composables -->
  <!-- Этот компонент управляет логикой и передаёт данные в composables -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useQrCamera } from '../composables/useQrCamera'

const props = defineProps({
  // Данные объекта для отображения в заголовке
  itemInfo: {
    type: Object,
    default: () => ({
      buh_name: '',
      inv_number: ''
    })
  },
  // Управление видимостью
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['scan', 'close', 'error'])

// Реактивные переменные
const isLoading = ref(false)
const errorMessage = ref('')

// Инициализация composable для работы с камерой
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

// Запуск сканирования при открытии
const startScanning = () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    // Запускаем сканирование камерой
    startCameraScan()
  } catch (error) {
    errorMessage.value = `Ошибка запуска сканирования: ${error.message}`
    emit('error', error)
  } finally {
    isLoading.value = false
  }
}

// Закрытие оверлея
const handleClose = () => {
  stopCameraScan()
  emit('close')
}

// Следим за изменением isOpen
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
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