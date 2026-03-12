export function usePhotoCamera(options = {}) {
  let stream = null
  let videoElement = null
  let canvasElement = null
  const { onPhoto, onError } = options

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    
    const overlay = document.getElementById('photo-camera-overlay')
    if (overlay) overlay.remove()
  }

  const takePhoto = () => {
    if (!videoElement || !canvasElement) return

    const context = canvasElement.getContext('2d')
    canvasElement.width = videoElement.videoWidth
    canvasElement.height = videoElement.videoHeight
    
    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)
    
    canvasElement.toBlob((blob) => {
      if (onPhoto) onPhoto(blob)
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const startCamera = async () => {
    try {
      const overlay = document.createElement('div')
      overlay.id = 'photo-camera-overlay'
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
      closeButton.onclick = stopCamera

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
      captureButton.onclick = takePhoto

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
      cancelButton.onclick = stopCamera

      videoContainer.appendChild(videoElement)
      videoContainer.appendChild(closeButton)
      overlay.appendChild(videoContainer)
      overlay.appendChild(captureButton)
      overlay.appendChild(cancelButton)
      overlay.appendChild(canvasElement)
      document.body.appendChild(overlay)

      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
      
      videoElement.srcObject = stream
      await videoElement.play()

    } catch (error) {
      console.error('Ошибка камеры:', error)
      const errorMsg = 'Ошибка камеры: ' + error.message
      if (onError) onError(errorMsg)
      stopCamera()
    }
  }

  return {
    startCamera,
    stopCamera
  }
}