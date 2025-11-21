import { ref } from 'vue'

export function useQrCamera(emit) {
  let html5QrcodeInstance = null

  const startCameraScan = () => {
    // Создаём элемент для preview камеры
    const cameraElement = document.createElement('div')
    cameraElement.id = 'camera-preview'
    cameraElement.style.width = '300px'
    cameraElement.style.height = '300px'
    document.body.appendChild(cameraElement)

    // Запускаем камеру
    html5QrcodeInstance = new Html5Qrcode('camera-preview')
    
    html5QrcodeInstance.start(
      { facingMode: "environment" }, // задняя камера
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (result) => {
        // Код найден!
        emit('scan', result)
        stopCameraScan()
      },
      (error) => {
        console.log('Сканирование...', error)
      }
    ).catch(err => {
      emit('error', 'Ошибка камеры: ' + err.message)
    })
  }

  const stopCameraScan = () => {
    if (html5QrcodeInstance) {
      html5QrcodeInstance.stop()
      html5QrcodeInstance.clear()
      // Убираем элемент preview
      const element = document.getElementById('camera-preview')
      if (element) element.remove()
    }
  }

  return {
    startCameraScan,
    stopCameraScan
  }
}