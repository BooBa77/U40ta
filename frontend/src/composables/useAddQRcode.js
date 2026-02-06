/**
 * Композабл для добавления и перепривязки QR-кодов к объектам
 * Используется в ObjectFormModal и Statement
 */
import { ref } from 'vue'
import { qrService } from '@/services/QrService.js'

export function useAddQRcode() {
  const isScanning = ref(false)
  const error = ref(null)

  /**
   * Добавляет QR-код к объекту с проверкой на существование
   * @param {string} qrValue - Значение QR-кода
   * @param {number} targetObjectId - ID объекта для привязки
   * @returns {Promise<boolean>} true если успешно
   */
  const addQrCode = async (qrValue, targetObjectId) => {
    if (!qrValue?.trim()) {
      error.value = 'QR-код не может быть пустым'
      return false
    }

    if (!targetObjectId) {
      error.value = 'Не указан объект для привязки'
      return false
    }

    try {
      // Проверяем, существует ли QR-код
      const existingQr = await qrService.getQrCodeWithObject(qrValue)
      
      if (existingQr?.objectId && existingQr.objectId !== targetObjectId) {
        // QR уже привязан к другому объекту - запрашиваем подтверждение
        const confirmReassign = confirm(
          `QR-код "${qrValue}" уже привязан к другому объекту.\nПерепривязать?`
        )
        
        if (!confirmReassign) {
          return false
        }
      }
      
      // Привязываем QR к объекту
      await qrService.assignQrToObject(qrValue, targetObjectId)
      return true
      
    } catch (err) {
      error.value = `Ошибка привязки QR: ${err.message}`
      console.error('Ошибка добавления QR:', err)
      return false
    }
  }

  /**
   * Запускает сканирование QR-кода камерой
   * @param {number} targetObjectId - ID объекта для привязки
   * @returns {Promise<string|null>} Значение QR или null
   */
  const scanQrCode = async (targetObjectId) => {
    isScanning.value = true
    error.value = null
    
    try {
      // TODO: Интеграция с нативным сканером камеры
      // Временная заглушка - имитация сканирования
      const simulatedQr = prompt('Введите QR-код (имитация сканирования):')
      
      if (simulatedQr) {
        const success = await addQrCode(simulatedQr, targetObjectId)
        return success ? simulatedQr : null
      }
      
      return null
    } catch (err) {
      error.value = `Ошибка сканирования: ${err.message}`
      return null
    } finally {
      isScanning.value = false
    }
  }

  return {
    isScanning,
    error,
    addQrCode,
    scanQrCode
  }
}