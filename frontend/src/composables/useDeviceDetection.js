import { ref, onMounted } from 'vue'

export function useDeviceDetection() {
  const isMobile = ref(false)
  const hasCamera = ref(false)
  const supportsAutoRotate = ref(false) // заглушка

  const checkMobile = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    
    // Проверка по userAgent ИЛИ наличию touch-событий
    return mobileRegex.test(userAgent) || ('ontouchstart' in window)
  }

  const checkCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return false
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some(device => device.kind === 'videoinput')
    } catch (error) {
      console.error('Ошибка проверки камеры:', error)
      return false
    }
  }

  onMounted(async () => {
    isMobile.value = checkMobile()
    hasCamera.value = await checkCamera()
    // supportsAutoRotate оставляем заглушкой
  })

  return {
    isMobile,
    hasCamera,
    supportsAutoRotate
  }
}