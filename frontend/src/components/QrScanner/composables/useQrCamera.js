import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export function useQrCamera(options = {}) {
  let html5QrcodeInstance = null
  const { onScan, onError, itemInfo } = options

  const stopCameraScan = () => {
    if (html5QrcodeInstance) {
      html5QrcodeInstance.stop().then(() => {
        html5QrcodeInstance.clear()
      }).catch(console.error)
    }
    
    const overlay = document.getElementById('camera-overlay')
    if (overlay) overlay.remove()
  }

  const startCameraScan = async () => {
    try {
      const cameraOverlay = document.createElement('div')
      cameraOverlay.id = 'camera-overlay'
      cameraOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: black;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      `

      // Заголовок с информацией об объекте
      if (itemInfo?.buh_name || itemInfo?.inv_number) {
        const infoHeader = document.createElement('div')
        infoHeader.style.cssText = `
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 15px 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
          max-width: 80%;
          backdrop-filter: blur(5px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        `
        
        // Строка 1: "Добавить QR-код для"
        const titleLine = document.createElement('div')
        titleLine.textContent = 'Добавить QR-код для:'
        titleLine.style.cssText = `
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        `
        
        // Строка 2: Наименование
        const nameLine = document.createElement('div')
        nameLine.textContent = itemInfo.buh_name || ''
        nameLine.style.cssText = `
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        `
        
        // Строка 3: Инвентарный номер
        const invLine = document.createElement('div')
        invLine.textContent = itemInfo.inv_number || ''
        invLine.style.cssText = `
          font-size: 14px;
          opacity: 0.9;
          font-family: monospace;
          letter-spacing: 0.5px;
        `
        
        infoHeader.appendChild(titleLine)
        infoHeader.appendChild(nameLine)
        infoHeader.appendChild(invLine)
        cameraOverlay.appendChild(infoHeader)
      }

      const cameraContainer = document.createElement('div')
      cameraContainer.id = 'camera-container'
      cameraContainer.style.cssText = `
        width: 100%;
        max-width: 400px;
        height: 400px;
        position: relative;
        margin-bottom: 20px;
      `

      const closeButton = document.createElement('button')
      closeButton.textContent = '✕'
      closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 20px;
        z-index: 10001;
        cursor: pointer;
      `
      closeButton.onclick = stopCameraScan

      const cancelButton = document.createElement('button')
      cancelButton.textContent = 'Отмена'
      cancelButton.style.cssText = `
        background: rgba(255,255,255,0.9);
        color: #333;
        border: none;
        border-radius: 25px;
        padding: 12px 24px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
      `
      cancelButton.onclick = stopCameraScan

      cameraContainer.appendChild(closeButton)
      cameraOverlay.appendChild(cameraContainer)
      cameraOverlay.appendChild(cancelButton)
      document.body.appendChild(cameraOverlay)

      html5QrcodeInstance = new Html5Qrcode('camera-container')

      const allSupportedFormats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
      
      await html5QrcodeInstance.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          formatsToSupport: allSupportedFormats
        },
        (result) => {
          console.log('Найден код:', result)
          if (onScan) onScan(result)
          stopCameraScan()
        },
        (error) => {
          console.log('Сканирование...')
        }
      )

    } catch (error) {
      console.error('Ошибка камеры:', error)
      const errorMsg = 'Ошибка камеры: ' + error.message
      if (onError) onError(errorMsg)
      stopCameraScan()
    }
  }

  return {
    startCameraScan,
    stopCameraScan
  }
}