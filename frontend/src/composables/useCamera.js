/**
 * Composable для работы с камерой устройства
 * 
 * Предоставляет:
 * - Проверку наличия камеры
 * - Отображение кастомного оверлея с видеопотоком
 * - Съёмку фото с возвратом Blob
 * - Автоматическое освобождение ресурсов
 */

import { ref } from 'vue'

export function useCamera() {
  const hasCamera = ref(null)
  const isOpen = ref(false)
  
  let stream = null
  let videoElement = null
  let canvasElement = null
  let currentResolve = null
  let currentReject = null

  /**
   * Проверяет наличие камеры на устройстве
   */
  const checkCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        hasCamera.value = false
        return
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      hasCamera.value = devices.some(device => device.kind === 'videoinput')
    } catch (error) {
      console.error('Ошибка проверки камеры:', error)
      hasCamera.value = false
    }
  }

  /**
   * Останавливает камеру и удаляет оверлей
   */
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    
    const overlay = document.getElementById('camera-overlay')
    if (overlay) overlay.remove()
    
    videoElement = null
    canvasElement = null
    isOpen.value = false
  }

  /**
   * Выполняет съёмку текущего кадра
   */
  const capturePhoto = () => {
    if (!videoElement || !canvasElement) {
      currentReject?.(new Error('Камера не инициализирована'))
      stopCamera()
      return
    }

    const context = canvasElement.getContext('2d')
    canvasElement.width = videoElement.videoWidth
    canvasElement.height = videoElement.videoHeight
    
    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)
    
    canvasElement.toBlob((blob) => {
      if (currentResolve) {
        currentResolve(blob)
      }
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  /**
   * Открывает камеру и возвращает Promise с Blob фото
   * @returns {Promise<Blob>}
   */
  const takePhoto = () => {
    return new Promise((resolve, reject) => {
      currentResolve = resolve
      currentReject = reject
      
      try {
        // Создаём оверлей
        const overlay = document.createElement('div')
        overlay.id = 'camera-overlay'
        overlay.style.cssText = `
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

        const videoContainer = document.createElement('div')
        videoContainer.style.cssText = `
          width: 100%;
          max-width: 400px;
          height: 400px;
          position: relative;
          margin-bottom: 20px;
          background: #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
        `

        videoElement = document.createElement('video')
        videoElement.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `
        videoElement.autoplay = true
        videoElement.playsInline = true

        canvasElement = document.createElement('canvas')
        canvasElement.style.display = 'none'

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
        closeButton.onclick = () => {
          currentReject(new Error('Отменено пользователем'))
          stopCamera()
        }

        const captureButton = document.createElement('button')
        captureButton.textContent = 'Сделать фото'
        captureButton.style.cssText = `
          background: white;
          color: #333;
          border: none;
          border-radius: 30px;
          padding: 15px 40px;
          font-size: 18px;
          font-weight: 500;
          cursor: pointer;
          margin: 20px 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `
        captureButton.onclick = capturePhoto

        const cancelButton = document.createElement('button')
        cancelButton.textContent = 'Отмена'
        cancelButton.style.cssText = `
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 25px;
          padding: 12px 24px;
          font-size: 16px;
          cursor: pointer;
          backdrop-filter: blur(5px);
        `
        cancelButton.onclick = () => {
          currentReject(new Error('Отменено пользователем'))
          stopCamera()
        }

        videoContainer.appendChild(videoElement)
        videoContainer.appendChild(closeButton)
        overlay.appendChild(videoContainer)
        overlay.appendChild(captureButton)
        overlay.appendChild(cancelButton)
        overlay.appendChild(canvasElement)
        document.body.appendChild(overlay)

        isOpen.value = true

        // Запускаем камеру
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        }).then((mediaStream) => {
          stream = mediaStream
          videoElement.srcObject = stream
          return videoElement.play()
        }).catch((error) => {
          currentReject(error)
          stopCamera()
        })

      } catch (error) {
        currentReject(error)
        stopCamera()
      }
    })
  }

  // Проверяем камеру при инициализации
  checkCamera()

  return {
    hasCamera,
    isOpen,
    takePhoto
  }
}