import { ref, onMounted, onUnmounted } from 'vue'

const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

export function useFlightMode() {
  const isFlightMode = ref(false)
  
  const updateFromStorage = () => {
    const saved = localStorage.getItem(FLIGHT_MODE_KEY)
    isFlightMode.value = saved ? JSON.parse(saved) : false
  }
  
  // Слушаем изменения в localStorage (если другая вкладка изменила)
  const handleStorageChange = (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      updateFromStorage()
    }
  }
  
  onMounted(() => {
    updateFromStorage()
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('flight-mode-changed', updateFromStorage)
  })
  
  onUnmounted(() => {
    window.removeEventListener('storage', handleStorageChange)
    window.removeEventListener('flight-mode-changed', updateFromStorage)
  })
  
  return {
    isFlightMode,
    updateFromStorage
  }
}