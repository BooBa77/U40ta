import { ref, onMounted } from 'vue'

export function useCamera() {
  const hasCamera = ref(null)

  const checkCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        hasCamera.value = false
        return
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      hasCamera.value = devices.some(device => device.kind === 'videoinput')
    } catch (error) {
      console.error('Ошибка проверки камеры:', error)
      hasCamera.value = false
    }
  }

  // Проверяем при создании композабла
  onMounted(() => {
    checkCamera()
  })

  return {
    hasCamera
  }
}