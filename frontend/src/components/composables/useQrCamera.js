import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export function useQrCamera(emit) {
  let html5QrcodeInstance = null

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
          console.log('✅ Найден код:', result)
          emit('scan', result)
          stopCameraScan()
        },
        (error) => {
          console.log('Сканирование...')
        }
      )

    } catch (error) {
      console.error('❌ Ошибка камеры:', error)
      emit('error', 'Ошибка камеры: ' + error.message)
      stopCameraScan()
    }
  }

  return {
    startCameraScan,
    stopCameraScan
  }
}