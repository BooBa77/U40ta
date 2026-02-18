import { ref } from 'vue'
import { useQrCamera } from '@/components/QRScanner/composables/useQrCamera'
import { qrService } from '@/services/qr-service'

export function useObjectQrManager(objectData, { onCancel } = {}) {
  const pendingQrCodes = ref([])
  const isScanning = ref(false)
  
  // Сканирование QR-кода
  const scanQrCode = async ({ isFirst = false } = {}) => {
    isScanning.value = true
    
    try {
      // Используем композабл камеры
      const { startCameraScan } = useQrCamera({
        onScan: async (result) => {
          // Обрабатываем результат сканирования
          await handleScannedCode(result)
          
          // Если это первый код и он не добавился (закрыли камеру)
          if (isFirst && !pendingQrCodes.value.length) {
            onCancel?.()
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
  
  // Обработка отсканированного кода
  const handleScannedCode = async (qrCode) => {
    try {
      // Проверяем существование кода в БД
      const existing = await qrService.findObjectIdByQrCode(qrCode)
      
      if (existing) {
        console.log(`Код ${qrCode} уже привязан к объекту ${existing.object_id}, будет перезаписан`)
      }
      
      // Добавляем в массив (дубликаты не проверяем - пусть хоть сто раз)
      pendingQrCodes.value.push(qrCode)
      console.log('Код добавлен в очередь:', qrCode)
      
    } catch (error) {
      console.error('Ошибка проверки кода:', error)
      // Даже при ошибке проверки добавляем - последний сохранил
      pendingQrCodes.value.push(qrCode)
    }
  }
  
  // Загрузка существующих кодов объекта (для режима редактирования)
  const loadExistingQrCodes = async (objectId) => {
    try {
      const codes = await qrService.getObjectQrCodes?.(objectId) || []
      // Если есть метод получения кодов объекта - добавляем их в pending
      pendingQrCodes.value = [...pendingQrCodes.value, ...codes]
    } catch (error) {
      console.error('Ошибка загрузки существующих кодов:', error)
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
    // Останавливаем камеру, если активна
    const { stopCameraScan } = useQrCamera()
    stopCameraScan()
  }
  
  return {
    pendingQrCodes,
    isScanning,
    scanQrCode,
    loadExistingQrCodes,
    saveQrCodes,
    reset
  }
}