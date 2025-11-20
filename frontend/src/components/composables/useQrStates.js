import { ref } from 'vue'

export function useQrStates() {
  // Состояния сканирования
  const isScanning = ref(false)
  const isSuccess = ref(false)
  const isError = ref(false)
  const errorMessage = ref('')
  const scanResult = ref(null)

  // Функции управления состояниями
const setScanning = () => {
  console.log('setScanning: сбрасываем состояния')
  isScanning.value = true
  isSuccess.value = false
  isError.value = false
  errorMessage.value = ''
  scanResult.value = null
}

const setSuccess = (result) => {
  console.log('setSuccess: устанавливаем успех с результатом', result)
  isScanning.value = false
  isSuccess.value = true
  scanResult.value = result
}

  const setError = (message) => {
    isScanning.value = false
    isError.value = true
    errorMessage.value = message
  }

  const reset = () => {
    isScanning.value = false
    isSuccess.value = false
    isError.value = false
    errorMessage.value = ''
    scanResult.value = null
  }

  return {
    states: {
      isScanning,
      isSuccess, 
      isError,
      errorMessage,
      scanResult
    },
    setScanning,
    setSuccess,
    setError,
    reset
  }
}