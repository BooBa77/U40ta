import { ref } from 'vue'
import { useQrCamera } from '@/components/QrScanner/composables/useQrCamera'
import { qrService } from '@/services/qr-service.js'

export function useObjectQrCodes(objectData, { onCancel } = {}) {
  const pendingQrCodes = ref(new Set())
  const isScanning = ref(false)
  
  /**
   * Обработка отсканированного кода: проверка существования в БД и добавление в очередь
   * @param {string} qrCode - значение QR-кода
   * @param {Object} options
   * @param {boolean} [options.isFirst] - первый ли это код (для отмены при отказе)
   * @returns {Promise<boolean>} true если код добавлен в очередь
   */
  const handleScannedCode = async (qrCode, { isFirst = false } = {}) => {
      try {
        const existing = await qrService.findObjectByQrCode(qrCode)
        
        console.log('DEBUG: existing.objectId', existing?.objectId)
        console.log('DEBUG: objectData.value.id', objectData.value.id)
        
        if (existing?.objectId) {
          // Код уже привязан к текущему объекту — молча игнорируем
          if (existing.objectId === objectData.value.id) {
            console.log('QR-код уже привязан к этому объекту, пропускаем:', qrCode)
            return true
          }
          
          // Код привязан к другому объекту — спрашиваем
          const otherInfo = existing.object 
            ? `${existing.object.invNumber} ${existing.object.buhName}` 
            : 'другому объекту'
          const confirmReassign = confirm(
            `QR-код "${qrCode}" уже привязан к ${otherInfo}.\nПерепривязать к этому объекту?`
          )
          
          if (!confirmReassign) {
            if (isFirst) {
              onCancel?.()
            }
            return false
          }
        }
        
        pendingQrCodes.value.add(qrCode)
        console.log('Код добавлен в очередь:', qrCode)
        return true
        
      } catch (error) {
        console.error('Ошибка проверки кода:', error)
        pendingQrCodes.value.add(qrCode)
        return true
      }
  }
  
  /**
   * Сканирование QR-кода камерой
   * @param {Object} [options]
   * @param {boolean} [options.isFirst] - первый ли это код
   */
  const scanQrCode = async ({ isFirst = false } = {}) => {
    isScanning.value = true
    
    try {
      const { startCameraScan } = useQrCamera({
        onScan: async (result) => {
          const added = await handleScannedCode(result, { isFirst })
          if (!added && isFirst) {
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
  
  /**
   * Обработка переданного QR-кода без сканирования
   * @param {string} qrCode - значение QR-кода
   */
  const processInitialQrCode = async (qrCode) => {
    isScanning.value = true
    try {
      await handleScannedCode(qrCode, { isFirst: true })
    } finally {
      isScanning.value = false
    }
  }
  
  /**
   * Сброс состояния
   */
  const resetQr = () => {
    pendingQrCodes.value.clear()
    isScanning.value = false
    const { stopCameraScan } = useQrCamera()
    stopCameraScan?.()
  }
  
  return {
    pendingQrCodes,
    isScanning,
    scanQrCode,
    processInitialQrCode,
    resetQr
  }
}