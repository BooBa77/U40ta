<template>
  <!-- Оверлей создается динамически через useQrCamera -->
</template>

<script setup>
import { watch, onUnmounted } from 'vue'
import { useQrCamera } from '../composables/useQrCamera'

const props = defineProps({
  itemInfo: {
    type: Object,
    default: () => ({ buh_name: '', inv_number: '' })
  },
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['scan', 'close', 'error'])

const { startCameraScan, stopCameraScan } = useQrCamera({
  onScan: (result) => {
    console.log('QR отсканирован через камеру:', result)
    emit('scan', result)
    handleClose()
  },
  onError: (error) => {
    console.error('Ошибка камеры:', error)
    emit('error', error)
  },
  itemInfo: props.itemInfo
})

const handleClose = () => {
  stopCameraScan()
  emit('close')
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      startCameraScan()
    } else {
      handleClose()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  handleClose()
})
</script>