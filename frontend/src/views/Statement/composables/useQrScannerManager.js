import { qrService } from '@/components/QrScanner/services/qr.service'

export function useQrScannerManager(openObjectFormCallback) {
  /**
   * Обработка отсканированного QR-кода
   */
  const handleQrScan = async ({ qrCode, rowData }) => {
    console.log('Обработка отсканированного QR:', { qrCode, rowData })
    
    try {
      // ВРЕМЕННО: пропускаем проверку QR (API endpoint 404)
      // const qrWithObject = await qrService.getQrCodeWithObject(qrCode)
      const qrWithObject = null // Заглушка
      
      if (!qrWithObject) {
        // Сценарий А: код не найден
        console.log('QR-код не найден, создаём новый объект')
        openObjectFormCallback({
          mode: 'create',
          qrCode: qrCode,
          rowData: rowData
        })
      } else {
        // Сценарий Б: код найден
        const { qrRecord, objectData } = qrWithObject
        console.log('QR-код уже существует:', qrWithObject)
        
        // Показываем предупреждение
        const confirmed = window.confirm(
          `Этот QR-код уже привязан к объекту:\n\n` +
          `Инв. номер: ${objectData.inv_number}\n` +
          `Наименование: ${objectData.buh_name}\n` +
          `Склад: ${objectData.zavod}/${objectData.sklad}\n\n` +
          `Перепривязать к текущему объекту?`
        )
        
        if (confirmed) {
          openObjectFormCallback({
            mode: 'reassign',
            qrCode: qrCode,
            existingObjectId: qrRecord.object_id,
            existingObjectData: objectData,
            rowData: rowData
          })
        }
      }
    } catch (error) {
      console.error('Ошибка проверки QR-кода:', error)
      // Даже при ошибке открываем форму (на всякий случай)
      openObjectFormCallback({
        mode: 'create',
        qrCode: qrCode,
        rowData: rowData
      })
    }
  }

  return {
    handleQrScan
  }
}