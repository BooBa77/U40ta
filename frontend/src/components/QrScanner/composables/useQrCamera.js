/**
 * Composable для сканирования QR-кодов через камеру устройства.
 *
 * Отладочная информация выводится прямо в оверлее, под кнопкой "Отмена".
 *
 * @module useQrCamera
 */

import { ref, onUnmounted } from 'vue'

import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import { BarcodeDetector } from 'barcode-detector/ponyfill'

export function useQrCamera(options = {}) {
  const { onScan, onError, itemInfo, debug = true } = options

  const isScanning = ref(false)

  let stream = null
  let videoElement = null
  let overlayElement = null
  let debugPanelBodyElement = null
  let scanIntervalId = null
  let zxingReader = null
  let zxingControls = null
  let barcodeDetector = null
  let currentDeviceId = null
  let focusIntervalId = null

  const debugData = {
    cameras: [],
    selectedCamera: null,
    selectedReason: '',
    scannerType: '',
    supportedFormats: [],
    videoResolution: '',
    videoFps: '',
    focusSupported: false,
    focusMode: '',
    scanAttempts: 0,
    scanSuccess: 0,
    lastError: '',
    status: 'init'
  }

  /**
   * Проверяет, поддерживает ли браузер нативный BarcodeDetector.
   */
  const hasNativeBarcodeDetector = () => {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window
  }

  /**
   * Получает список видеоустройств.
   */
  const getVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'videoinput')
    } catch (error) {
      console.error('[useQrCamera] Ошибка получения списка камер:', error)
      return []
    }
  }

  /**
   * Собирает capabilities для всех камер.
   */
  const collectCameraInfo = async () => {
    const devices = await getVideoDevices()
    const result = []

    for (const device of devices) {
      const info = {
        deviceId: device.deviceId,
        shortId: device.deviceId.slice(0, 8),
        label: device.label || '(без названия)',
        capabilities: null,
        error: null
      }

      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        })
        const track = tempStream.getVideoTracks()[0]
        info.capabilities = track.getCapabilities ? track.getCapabilities() : {}
        track.stop()
        tempStream.getTracks().forEach((t) => t.stop())
      } catch (error) {
        info.error = error.message
      }

      result.push(info)
    }

    return result
  }

  /**
   * Выбирает лучшую камеру.
   */
  const selectBestCamera = async () => {
    const cameras = await collectCameraInfo()
    debugData.cameras = cameras

    if (cameras.length === 0) return null
    if (cameras.length === 1) {
      debugData.selectedCamera = cameras[0]
      debugData.selectedReason = 'Единственная камера'
      return cameras[0].deviceId
    }

    const scoredDevices = []

    for (const cam of cameras) {
      let score = 0
      const reasons = []
      const caps = cam.capabilities || {}

      if (caps.focusDistance) {
        const minFocus = caps.focusDistance.min || Infinity
        const maxFocus = caps.focusDistance.max || 0
        score += 1000 - minFocus
        score += (maxFocus - minFocus) / 10
        reasons.push(`focus.min=${minFocus}`)
      }

      const label = (cam.label || '').toLowerCase()
      if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
        score += 500
        reasons.push('rear')
      }

      if (caps.width && caps.height) {
        score += (caps.width.max || 0) / 100
        reasons.push(`${caps.width.max}x${caps.height.max}`)
      }

      scoredDevices.push({ cam, score, reasons })
    }

    scoredDevices.sort((a, b) => b.score - a.score)

    const best = scoredDevices[0]
    debugData.selectedCamera = best.cam
    debugData.selectedReason = best.reasons.join(', ') || 'по умолчанию'

    return best.cam.deviceId
  }

  /**
   * Пытается включить непрерывный автофокус.
   */
  const tryEnableContinuousFocus = async (track) => {
    if (!track || !track.applyConstraints) return

    const caps = track.getCapabilities ? track.getCapabilities() : {}
    debugData.focusSupported = !!caps.focusMode

    if (caps.focusMode) {
      debugData.focusMode = Array.isArray(caps.focusMode)
        ? caps.focusMode.join(', ')
        : String(caps.focusMode)
    }

    try {
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        })
      }
    } catch (error) {
      debugData.lastError = 'focus: ' + error.message
    }
  }

  /**
   * Периодически "подталкивает" камеру к фокусировке.
   */
  const startFocusLoop = (track) => {
    stopFocusLoop()

    const caps = track.getCapabilities ? track.getCapabilities() : {}
    if (!caps.focusMode) return

    focusIntervalId = setInterval(async () => {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'single-shot' }]
        })
        setTimeout(async () => {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            })
          } catch (e) { /* ignore */ }
        }, 100)
      } catch (error) { /* ignore */ }
    }, 3000)
  }

  const stopFocusLoop = () => {
    if (focusIntervalId) {
      clearInterval(focusIntervalId)
      focusIntervalId = null
    }
  }

  /**
   * Останавливает сканирование.
   */
  const stopCameraScan = () => {
    isScanning.value = false

    if (scanIntervalId) {
      clearInterval(scanIntervalId)
      scanIntervalId = null
    }

    stopFocusLoop()

    if (zxingControls) {
      try { zxingControls.stop() } catch (e) { /* ignore */ }
      zxingControls = null
    }
    zxingReader = null
    barcodeDetector = null

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    if (videoElement) {
      videoElement.srcObject = null
      videoElement.remove()
      videoElement = null
    }

    if (overlayElement) {
      overlayElement.remove()
      overlayElement = null
    }

    debugPanelBodyElement = null
    currentDeviceId = null
  }

  /**
   * Обновляет текст в отладочной панели.
   */
  const updateDebugPanel = () => {
    if (!debugPanelBodyElement) return

    const caps = debugData.selectedCamera?.capabilities || {}
    const focusDistance = caps.focusDistance
      ? `${caps.focusDistance.min ?? '?'} – ${caps.focusDistance.max ?? '?'}`
      : '—'

    const lines = []

    lines.push('=== СТАТУС ===')
    lines.push(`status: ${debugData.status}`)
    lines.push(`scanner: ${debugData.scannerType || '—'}`)
    lines.push(`video: ${debugData.videoResolution || '—'} @ ${debugData.videoFps || '—'} fps`)

    lines.push('')
    lines.push('=== ФОКУС (выбранной камеры) ===')
    lines.push(`focusMode supported: ${debugData.focusSupported ? 'YES' : 'NO'}`)
    lines.push(`focusMode values: ${debugData.focusMode || '—'}`)
    lines.push(`focusDistance: ${focusDistance}`)

    lines.push('')
    lines.push('=== СКАНИРОВАНИЕ ===')
    lines.push(`attempts: ${debugData.scanAttempts}`)
    lines.push(`success: ${debugData.scanSuccess}`)
    lines.push(`formats (${debugData.supportedFormats.length}):`)
    lines.push(`  ${debugData.supportedFormats.join(', ') || '—'}`)

    if (debugData.lastError) {
      lines.push('')
      lines.push('=== ПОСЛЕДНЯЯ ОШИБКА ===')
      lines.push(debugData.lastError)
    }

    lines.push('')
    lines.push(`=== КАМЕРЫ (${debugData.cameras.length}) ===`)
    debugData.cameras.forEach((cam, i) => {
      const isSelected = cam.deviceId === debugData.selectedCamera?.deviceId
      const c = cam.capabilities || {}
      const fd = c.focusDistance
        ? `${c.focusDistance.min ?? '?'}–${c.focusDistance.max ?? '?'}`
        : '—'
      const fm = c.focusMode
        ? (Array.isArray(c.focusMode) ? c.focusMode.join(',') : c.focusMode)
        : '—'
      const res = c.width ? `${c.width.max}x${c.height.max}` : '—'

      lines.push(`${isSelected ? '▶' : ' '} [${i}] ${cam.label}`)
      lines.push(`     id: ${cam.shortId}…`)
      lines.push(`     res: ${res}`)
      lines.push(`     focusDistance: ${fd}`)
      lines.push(`     focusMode: ${fm}`)
      if (cam.error) lines.push(`     ERROR: ${cam.error}`)
    })

    lines.push('')
    lines.push('=== ВЫБОР ===')
    lines.push(debugData.selectedReason || '—')

    debugPanelBodyElement.textContent = lines.join('\n')
  }

  /**
   * Создает DOM-оверлей с видео, кнопками и отладочной панелью.
   */
  const createOverlay = () => {
    overlayElement = document.createElement('div')
    overlayElement.id = 'camera-overlay'
    overlayElement.style.cssText = `
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
      justify-content: flex-start;
      overflow-y: auto;
      padding: 20px;
      box-sizing: border-box;
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
        max-width: 90%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
      `

      const titleLine = document.createElement('div')
      titleLine.textContent = 'Сканирование QR-кода для:'
      titleLine.style.cssText = `font-size: 14px; opacity: 0.9; margin-bottom: 8px;`

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

      const invLine = document.createElement('div')
      invLine.textContent = itemInfo.inv_number || ''
      invLine.style.cssText = `font-size: 14px; opacity: 0.9; font-family: monospace; letter-spacing: 0.5px;`

      infoHeader.appendChild(titleLine)
      infoHeader.appendChild(nameLine)
      infoHeader.appendChild(invLine)
      overlayElement.appendChild(infoHeader)
    }

    // Контейнер для видео
    const videoContainer = document.createElement('div')
    videoContainer.id = 'camera-container'
    videoContainer.style.cssText = `
      width: 100%;
      max-width: 400px;
      height: 400px;
      position: relative;
      margin-bottom: 20px;
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
    `

    // Видео-элемент
    videoElement = document.createElement('video')
    videoElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `
    videoElement.autoplay = true
    videoElement.playsInline = true
    videoElement.muted = true

    // Рамка для наведения
    const qrBox = document.createElement('div')
    qrBox.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 70%;
      height: 70%;
      border: 2px solid rgba(255, 255, 255, 0.7);
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    `

    // Кнопка закрытия
    const closeButton = document.createElement('button')
    closeButton.textContent = '✕'
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.5);
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

    videoContainer.appendChild(videoElement)
    videoContainer.appendChild(qrBox)
    videoContainer.appendChild(closeButton)

    overlayElement.appendChild(videoContainer)

    // Подсказка
    const hint = document.createElement('div')
    hint.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      text-align: center;
      padding: 0 20px;
      margin-top: 4px;
      margin-bottom: 12px;
      max-width: 400px;
      flex-shrink: 0;
    `
    hint.textContent =
      'Медленно приближайте и отдаляйте телефон, пока код не станет четким'
    overlayElement.appendChild(hint)

    // Кнопка отмены
    const cancelButton = document.createElement('button')
    cancelButton.textContent = 'Отмена-1'
    cancelButton.style.cssText = `
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      border: none;
      border-radius: 25px;
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      margin-bottom: 16px;
      flex-shrink: 0;
    `
    cancelButton.onclick = stopCameraScan
    overlayElement.appendChild(cancelButton)

    // ===== ОТЛАДОЧНАЯ ПАНЕЛЬ ПОД КНОПКОЙ =====
    if (debug) {
      const debugPanel = document.createElement('div')
      debugPanel.style.cssText = `
        width: 100%;
        max-width: 400px;
        background: rgba(0, 0, 0, 0.85);
        color: #0f0;
        font-family: monospace;
        font-size: 10px;
        line-height: 1.4;
        border-radius: 8px;
        border: 1px solid rgba(0, 255, 0, 0.3);
        padding: 10px;
        box-sizing: border-box;
        margin-bottom: 20px;
        white-space: pre-wrap;
        word-break: break-all;
        flex-shrink: 0;
      `
      debugPanel.textContent = 'Сбор отладочной информации...'
      overlayElement.appendChild(debugPanel)
      debugPanelBodyElement = debugPanel
    }

    document.body.appendChild(overlayElement)
    return videoElement
  }

  /**
   * BarcodeDetector.
   */
  const startBarcodeDetectorScan = async (video) => {
    debugData.scannerType = 'BarcodeDetector (native)'
    updateDebugPanel()

    barcodeDetector = new BarcodeDetector({
      formats: [
        'qr_code',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'code_128',
        'code_39',
        'code_93',
        'codabar',
        'itf'
      ]
    })

    try {
      const supported = await barcodeDetector.getSupportedFormats()
      debugData.supportedFormats = supported
      updateDebugPanel()
    } catch (e) {
      debugData.lastError = 'getSupportedFormats: ' + e.message
      updateDebugPanel()
    }

    scanIntervalId = setInterval(async () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

      debugData.scanAttempts++

      try {
        const barcodes = await barcodeDetector.detect(video)
        if (barcodes.length > 0) {
          const result = barcodes[0].rawValue
          debugData.scanSuccess++
          debugData.status = 'FOUND'
          updateDebugPanel()
          if (onScan) onScan(result)
          stopCameraScan()
        } else {
          if (debugData.scanAttempts % 5 === 0) updateDebugPanel()
        }
      } catch (error) {
        debugData.lastError = error.message
        updateDebugPanel()
      }
    }, 300)
  }

  /**
   * ZXing.
   */
  const startZxingScan = async (video) => {
    debugData.scannerType = 'ZXing (fallback)'
    updateDebugPanel()

    const hints = new Map()
    const formats = [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF
    ]
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
    hints.set(DecodeHintType.TRY_HARDER, true)

    debugData.supportedFormats = formats.map((f) => BarcodeFormat[f] || String(f))
    updateDebugPanel()

    zxingReader = new BrowserMultiFormatReader(hints)

    try {
      zxingControls = await zxingReader.decodeFromVideoElement(video, (result, error) => {
        debugData.scanAttempts++
        if (result) {
          const text = result.getText()
          debugData.scanSuccess++
          debugData.status = 'FOUND'
          updateDebugPanel()
          if (onScan) onScan(text)
          stopCameraScan()
        } else {
          if (debugData.scanAttempts % 10 === 0) updateDebugPanel()
        }
      })
    } catch (error) {
      debugData.lastError = error.message
      updateDebugPanel()
      if (onError) onError('Ошибка запуска сканера: ' + error.message)
      stopCameraScan()
    }
  }

  /**
   * Читает реальные параметры видео.
   */
  const readVideoSettings = (track) => {
    try {
      const settings = track.getSettings ? track.getSettings() : {}
      debugData.videoResolution = settings.width && settings.height
        ? `${settings.width}x${settings.height}`
        : '—'
      debugData.videoFps = settings.frameRate ? settings.frameRate.toFixed(0) : '—'
    } catch (e) { /* ignore */ }
  }

  /**
   * Запуск.
   */
  const startCameraScan = async () => {
    if (isScanning.value) return
    isScanning.value = true

    try {
      debugData.status = 'creating overlay'
      // 1. Создаем оверлей сразу — чтобы панель появилась как можно раньше
      const video = createOverlay()
      updateDebugPanel()

      debugData.status = 'selecting camera'
      updateDebugPanel()

      // 2. Выбираем камеру
      currentDeviceId = await selectBestCamera()
      updateDebugPanel()

      if (!currentDeviceId) {
        throw new Error('Не найдено ни одной камеры на устройстве')
      }

      debugData.status = 'requesting stream'
      updateDebugPanel()

      // 3. Запрашиваем поток
      const constraints = {
        video: {
          deviceId: { exact: currentDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: false
      }

      stream = await navigator.mediaDevices.getUserMedia(constraints)

      debugData.status = 'playing video'
      updateDebugPanel()

      // 4. Подключаем поток
      video.srcObject = stream
      await video.play()

      // 5. Читаем параметры
      const track = stream.getVideoTracks()[0]
      readVideoSettings(track)
      updateDebugPanel()

      // 6. Фокус
      debugData.status = 'configuring focus'
      updateDebugPanel()
      await tryEnableContinuousFocus(track)
      startFocusLoop(track)
      updateDebugPanel()

      // 7. Запускаем сканирование
      debugData.status = 'starting scan'
      updateDebugPanel()

      if (hasNativeBarcodeDetector()) {
        await startBarcodeDetectorScan(video)
      } else {
        await startZxingScan(video)
      }

      debugData.status = 'scanning'
      updateDebugPanel()
    } catch (error) {
      console.error('[useQrCamera] Ошибка запуска камеры:', error)
      isScanning.value = false
      debugData.status = 'ERROR'
      debugData.lastError = error.message
      updateDebugPanel()

      let message = error.message
      if (error.name === 'NotAllowedError') {
        message = 'Доступ к камере запрещен. Разрешите доступ в настройках браузера.'
      } else if (error.name === 'NotFoundError') {
        message = 'Камера не найдена на устройстве.'
      } else if (error.name === 'NotReadableError') {
        message = 'Камера занята другим приложением.'
      }

      if (onError) onError(message)
      // Не закрываем оверлей сразу — даем увидеть ошибку
      setTimeout(() => stopCameraScan(), 3000)
    }
  }

  onUnmounted(() => {
    stopCameraScan()
  })

  return {
    startCameraScan,
    stopCameraScan,
    isScanning
  }
}