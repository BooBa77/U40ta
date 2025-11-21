export function useQrCamera(emit) {
  let html5QrcodeInstance = null

  const startCameraScan = async () => {
    try {
      // Создаём полноэкранный overlay для камеры
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

      // Контейнер для preview камеры
      const cameraContainer = document.createElement('div')
      cameraContainer.id = 'camera-container'
      cameraContainer.style.cssText = `
        width: 100%;
        max-width: 400px;
        height: 400px;
        position: relative;
      `

      // Кнопка закрытия
      const closeButton = document.createElement('button')
      closeButton.textContent = '✕'
      closeButton.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
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

      cameraContainer.appendChild(closeButton)
      cameraOverlay.appendChild(cameraContainer)
      document.body.appendChild(cameraOverlay)

      // Ждём загрузки библиотеки
      if (!window.Html5Qrcode) {
        await loadHtml5QrcodeScript()
      }

      // Запускаем камеру
      html5QrcodeInstance = new Html5Qrcode('camera-container')
      
      await html5QrcodeInstance.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        (result) => {
          console.log('✅ Найден QR-код:', result)
          emit('scan', result)
          stopCameraScan()
        },
        (error) => {
          // Игнорируем ошибки сканирования (процесс идёт)
          console.log('Сканирование...')
        }
      )

    } catch (error) {
      console.error('❌ Ошибка камеры:', error)
      emit('error', 'Ошибка камеры: ' + error.message)
      stopCameraScan()
    }
  }

  const stopCameraScan = () => {
    if (html5QrcodeInstance) {
      html5QrcodeInstance.stop().then(() => {
        html5QrcodeInstance.clear()
      }).catch(console.error)
    }
    
    // Убираем overlay
    const overlay = document.getElementById('camera-overlay')
    if (overlay) overlay.remove()
  }

  const loadHtml5QrcodeScript = () => {
    return new Promise((resolve, reject) => {
      if (window.Html5Qrcode) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('CDN не доступен'))
      document.head.appendChild(script)
    })
  }

  return {
    startCameraScan,
    stopCameraScan
  }
}