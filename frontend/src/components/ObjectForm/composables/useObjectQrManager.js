import { ref } from 'vue'
import { useQrCamera } from '@/components/QrScanner/composables/useQrCamera'
import { qrService } from '@/services/qr-service.js'

export function useObjectQrManager(objectData, { onCancel } = {}) {
  const pendingQrCodes = ref([])
  const isScanning = ref(false)
  
  // Обработка отсканированного кода
  const handleScannedCode = async (qrCode, { isFirst = false } = {}) => {
    try {
      // Проверяем существование кода в БД
      const existing = await qrService.findObjectIdByQrCode(qrCode)
      
      if (existing?.object_id) {
        // Код уже привязан к другому объекту
        const confirmReassign = confirm(
          `QR-код "${qrCode}" уже привязан к другому объекту.\nПерепривязать к этому объекту?`
        )
        
        if (!confirmReassign) {
          // Если это первый код и пользователь отказался - закрываем модалку
          if (isFirst) {
            onCancel?.()
          }
          // Для дополнительного кода просто ничего не делаем
          return false
        }
        // Если согласился - код будет перезаписан при сохранении
      }
      
      // Добавляем код в очередь
      pendingQrCodes.value.push(qrCode)
      console.log('Код добавлен в очередь:', qrCode)
      return true
      
    } catch (error) {
      console.error('Ошибка проверки кода:', error)
      // При ошибке проверки всё равно добавляем - сохраним как есть
      pendingQrCodes.value.push(qrCode)
      return true
    }
  }
  
  // Сканирование QR-кода камерой
  const scanQrCode = async ({ isFirst = false } = {}) => {
    isScanning.value = true
    
    try {
      const { startCameraScan } = useQrCamera({
        onScan: async (result) => {
          const added = await handleScannedCode(result, { isFirst })
          if (!added && isFirst) {
            // Если первый код не добавился и пользователь отказался - onCancel уже вызван в handleScannedCode
            return
          }
        },
        onError: (error) => {
          console.error('Ошибка сканирования:', error)
          if (isFirst) onCancel?.()
        }
      })
      
      await startCameraScan()
      
    } catch (error) {
      console.error('Ошибка запуска камеры:', error)
      if (isFirst) onCancel?.()
    } finally {
      isScanning.value = false
    }
  }
  
  // Обработка переданного QR-кода без сканирования
  const processInitialQrCode = async (qrCode) => {
    isScanning.value = true
    try {
      await handleScannedCode(qrCode, true)
    } finally {
      isScanning.value = false
    }
  }
  
  // Сохранение всех кодов при привязке к объекту
  const saveQrCodes = async (savedObjectId) => {
    const results = []
    
    for (const qrCode of pendingQrCodes.value) {
      try {
        // Проверяем актуальное состояние
        const existing = await qrService.findObjectIdByQrCode(qrCode)
        
        if (existing) {
          // Код существует - обновляем владельца
          await qrService.updateQrCodeOwner(qrCode, savedObjectId)
          results.push({ qrCode, status: 'updated' })
        } else {
          // Код новый - создаём
          await qrService.createQrCode(qrCode, savedObjectId)
          results.push({ qrCode, status: 'created' })
        }
      } catch (error) {
        console.error(`Ошибка сохранения кода ${qrCode}:`, error)
        results.push({ qrCode, status: 'error', error })
      }
    }
    
    // Очищаем очередь после сохранения
    pendingQrCodes.value = []
    
    return results
  }
  
  // Сброс
  const reset = () => {
    pendingQrCodes.value = []
    isScanning.value = false
    const { stopCameraScan } = useQrCamera()
    stopCameraScan?.()
  }
  
  return {
    pendingQrCodes,
    isScanning,
    scanQrCode,
    processInitialQrCode,  // метод для переданного QR-кода
    saveQrCodes,
    reset
  }
}