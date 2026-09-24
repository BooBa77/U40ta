/**
 * Composable для сканирования QR-кодов через камеру устройства.
 *
 * Ключевые особенности:
 * - Самостоятельное управление камерой через getUserMedia (без html5-qrcode).
 * - Умный выбор камеры: приоритет отдается той, что умеет фокусироваться
 *   на близком расстоянии (на Android).
 * - Пытается управлять фокусом через applyConstraints (Android).
 * - Использует нативный BarcodeDetector, если он есть (Chrome/Android),
 *   иначе — ZXing (iOS/Safari).
 * - Показывает отладочную панель со всей информацией о камерах и сканере.
 *
 * @module useQrCamera
 */

import { ref, onUnmounted } from 'vue'

import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import { BarcodeDetector } from 'barcode-detector/ponyfill'

/**
 * Создает и управляет оверлеем камеры, запускает сканирование QR-кодов.
 *
 * @param {Object} options - опции
 * @param {Function} options.onScan - колбэк при успешном сканировании
 * @param {Function} [options.onError] - колбэк при ошибке
 * @param {Object} [options.itemInfo] - информация об объекте для заголовка
 * @param {boolean} [options.debug] - показывать отладочную панель
 * @returns {Object} { startCameraScan, stopCameraScan, isScanning }
 */
export function useQrCamera(options = {}) {
  const { onScan, onError, itemInfo, debug = true } = options

  const isScanning = ref(false)

  // Внутренние ссылки на ресурсы
  let stream = null
  let videoElement = null
  let overlayElement = null
  let scanIntervalId = null
  let zxingReader = null
  let zxingControls = null
  let barcodeDetector = null
  let currentDeviceId = null
  let focusIntervalId = null

  // Отладочные данные
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
    lastError: ''
  }

  let debugPanelElement = null
  let debugPanelBodyElement = null

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
   * Возвращает массив объектов с информацией о каждой камере.
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
   * Выбирает лучшую камеру для сканирования QR-кодов.
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

      // Приоритет 1: камера умеет фокусироваться на близком расстоянии
      if (caps.focusDistance) {
        const minFocus = caps.focusDistance.min || Infinity
        const maxFocus = caps.focusDistance.max || 0
        score += 1000 - minFocus
        score += (maxFocus - minFocus) / 10
        reasons.push(`focusDistance.min=${minFocus}`)
      }

      // Приоритет 2: задняя камера
      const label = (cam.label || '').toLowerCase()
      if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
        score += 500
        reasons.push('rear')
      }

      // Приоритет 3: разрешение
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

    console.log(
      `[useQrCamera] Выбрана камера: "${best.cam.label}" (score: ${best.score.toFixed(0)})`
    )

    return best.cam.deviceId
  }

  /**
   * Пытается включить непрерывный автофокус (Android).
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
        console.log('[useQrCamera] Включен непрерывный автофокус')
      }
    } catch (error) {
      console.warn('[useQrCamera] Не удалось включить автофокус:', error.message)
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
          } catch (e) {
            // ignore
          }
        }, 100)
      } catch (error) {
        // ignore
      }
    }, 3000)
  }

  const stopFocusLoop = () => {
    if (focusIntervalId) {
      clearInterval(focusIntervalId)
      focusIntervalId = null
    }
  }

  /**
   * Останавливает сканирование и освобождает ресурсы.
   */
  const stopCameraScan = () => {
    isScanning.value = false

    if (scanIntervalId) {
      clearInterval(scanIntervalId)
      scanIntervalId = null
    }

    stopFocusLoop()

    if (zxingControls) {
      try {
        zxingControls.stop()
      } catch (e) {
        // ignore
      }
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

    if (debugPanelElement) {
      debugPanelElement.remove()
      debugPanelElement = null
    }
    debugPanelBodyElement = null

    currentDeviceId = null
  }

  /**
   * Обновляет содержимое отладочной панели.
   */
  const updateDebugPanel = () => {
    if (!debugPanelBodyElement) return

    const caps = debugData.selectedCamera?.capabilities || {}
    const focusDistance = caps.focusDistance
      ? `${caps.focusDistance.min || '?'} – ${caps.focusDistance.max || '?'}`
      : '—'

    const camerasHtml = debugData.cameras
      .map((cam, i) => {
        const isSelected = cam.deviceId === debugData.selectedCamera?.deviceId
        const camCaps = cam.capabilities || {}
        const camFocusDistance = camCaps.focusDistance
          ? `${camCaps.focusDistance.min || '?'} – ${camCaps.focusDistance.max || '?'}`
          : '—'
        const camFocusMode = camCaps.focusMode
          ? (Array.isArray(camCaps.focusMode) ? camCaps.focusMode.join(',') : camCaps.focusMode)
          : '—'
        const camResolution = camCaps.width
          ? `${camCaps.width.max}x${camCaps.height.max}`
          : '—'

        return `
          <div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1);${isSelected ? 'color:#4ade80;font-weight:600;' : ''}">
            <div>[${i}] ${isSelected ? '▶ ' : ''}${cam.label.slice(0, 30)}</div>
            <div style="font-size:9px;opacity:0.7;padding-left:12px;">
              id: ${cam.shortId}… | res: ${camResolution}
            </div>
            <div style="font-size:9px;opacity:0.7;padding-left:12px;">
              focusDistance: ${camFocusDistance} | focusMode: ${camFocusMode}
            </div>
            ${cam.error ? `<div style="font-size:9px;color:#f87171;padding-left:12px;">err: ${cam.error}</div>` : ''}
          </div>
        `
      })
      .join('')

    debugPanelBodyElement.innerHTML = `
      <div style="margin-bottom:6px;">
        <b>Сканер:</b> ${debugData.scannerType || '—'}<br>
        <b>Разрешение:</b> ${debugData.videoResolution || '—'}<br>
        <b>FPS:</b> ${debugData.videoFps || '—'}<br>
        <b>Фокус поддерживается:</b> ${debugData.focusSupported ? '✅' : '❌'}<br>
        <b>Режимы фокуса:</b> ${debugData.focusMode || '—'}<br>
        <b>focusDistance выбранной:</b> ${focusDistance}<br>
      </div>
      <div style="margin-bottom:6px;">
        <b>Попыток сканирования:</b> ${debugData.scanAttempts}<br>
        <b>Успешных:</b> ${debugData.scanSuccess}<br>
        ${debugData.lastError ? `<b style="color:#f87171;">Ошибка:</b> ${debugData.lastError}<br>` : ''}
      </div>
      <div style="margin-bottom:4px;">
        <b>Форматы (${debugData.supportedFormats.length}):</b>
        <div style="font-size:9px;opacity:0.7;">${debugData.supportedFormats.join(', ') || '—'}</div>
      </div>
      <div style="margin-bottom:4px;">
        <b>Все камеры (${debugData.cameras.length}):</b>
        ${camerasHtml || '<div style="opacity:0.5;">нет данных</div>'}
      </div>
      <div style="font-size:9px;opacity:0.5;">
        Выбрана: ${debugData.selectedReason || '—'}
      </div>
    `
  }

  /**
   * Создает отладочную панель в углу экрана.
   */
  const createDebugPanel = () => {
    if (!debug) return

    debugPanelElement = document.createElement('div')
    debugPanelElement.style.cssText = `
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 10002;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      font-family: monospace;
      font-size: 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 320px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `

    // Заголовок (кликабельный для сворачивания)
    const header = document.createElement('div')
    header.textContent = '🔍 debug (нажми)'
    header.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.1);
      font-weight: bold;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `

    const toggleIcon = document.createElement('span')
    toggleIcon.textContent = '▼'
    header.appendChild(toggleIcon)

    // Тело панели
    debugPanelBodyElement = document.createElement('div')
    debugPanelBodyElement.style.cssText = `
      padding: 8px 10px;
      overflow-y: auto;
      max-height: 80vh;
      line-height: 1.4;
    `

    let collapsed = false
    header.onclick = () => {
      collapsed = !collapsed
      debugPanelBodyElement.style.display = collapsed ? 'none' : 'block'
      toggleIcon.textContent = collapsed ? '▶' : '▼'
    }

    debugPanelElement.appendChild(header)
    debugPanelElement.appendChild(debugPanelBodyElement)

    document.body.appendChild(debugPanelElement)

    // Первичное обновление
    updateDebugPanel()
  }

  /**
   * Создает DOM-оверлей с видео, кнопкой закрытия и подсказкой.
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

    // Подсказка
    const hint = document.createElement('div')
    hint.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      text-align: center;
      padding: 0 20px;
      margin-top: 10px;
      max-width: 400px;
    `
    hint.textContent =
      'Медленно приближайте и отдаляйте телефон, пока код не станет четким'

    // Кнопка отмены
    const cancelButton = document.createElement('button')
    cancelButton.textContent = 'Отмена'
    cancelButton.style.cssText = `
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      border: none;
      border-radius: 25px;
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
    `
    cancelButton.onclick = stopCameraScan

    overlayElement.appendChild(videoContainer)
    overlayElement.appendChild(hint)
    overlayElement.appendChild(cancelButton)

    document.body.appendChild(overlayElement)
    return videoElement
  }

  /**
   * Запускает сканирование через нативный BarcodeDetector.
   */
  const startBarcodeDetectorScan = async (video) => {
    debugData.scannerType = 'BarcodeDetector (native)'

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
      console.log('[useQrCamera] Поддерживаемые форматы:', supported)
    } catch (e) {
      debugData.lastError = 'getSupportedFormats: ' + e.message
    }

    updateDebugPanel()

    scanIntervalId = setInterval(async () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

      debugData.scanAttempts++

      try {
        const barcodes = await barcodeDetector.detect(video)
        if (barcodes.length > 0) {
          const result = barcodes[0].rawValue
          debugData.scanSuccess++
          updateDebugPanel()
          console.log('[useQrCamera] Найден код (BarcodeDetector):', result)
          if (onScan) onScan(result)
          stopCameraScan()
        } else {
          updateDebugPanel()
        }
      } catch (error) {
        debugData.lastError = error.message
        updateDebugPanel()
      }
    }, 300)
  }

  /**
   * Запускает сканирование через ZXing (fallback).
   */
  const startZxingScan = async (video) => {
    debugData.scannerType = 'ZXing (fallback)'

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

    debugData.supportedFormats = formats.map((f) => BarcodeFormat[f] || f)
    updateDebugPanel()

    zxingReader = new BrowserMultiFormatReader(hints)

    try {
      zxingControls = await zxingReader.decodeFromVideoElement(video, (result, error) => {
        debugData.scanAttempts++
        if (result) {
          const text = result.getText()
          debugData.scanSuccess++
          updateDebugPanel()
          console.log('[useQrCamera] Найден код (ZXing):', text)
          if (onScan) onScan(text)
          stopCameraScan()
        } else {
          // NotFoundException — норма, просто обновляем панель
          if (debugData.scanAttempts % 10 === 0) updateDebugPanel()
        }
      })
    } catch (error) {
      debugData.lastError = error.message
      updateDebugPanel()
      console.error('[useQrCamera] Ошибка запуска ZXing:', error)
      if (onError) onError('Ошибка запуска сканера: ' + error.message)
      stopCameraScan()
    }
  }

  /**
   * Считывает реальные параметры видео с трека.
   */
  const readVideoSettings = (track) => {
    try {
      const settings = track.getSettings ? track.getSettings() : {}
      debugData.videoResolution = settings.width && settings.height
        ? `${settings.width}x${settings.height}`
        : '—'
      debugData.videoFps = settings.frameRate ? settings.frameRate.toFixed(0) : '—'
    } catch (e) {
      // ignore
    }
  }

  /**
   * Запускает камеру и сканирование.
   */
  const startCameraScan = async () => {
    if (isScanning.value) return
    isScanning.value = true

    try {
      // 1. Создаем отладочную панель заранее
      createDebugPanel()

      // 2. Выбираем лучшую камеру
      currentDeviceId = await selectBestCamera()
      updateDebugPanel()

      if (!currentDeviceId) {
        throw new Error('Не найдено ни одной камеры на устройстве')
      }

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

      // 4. Создаем оверлей и получаем видео-элемент
      const video = createOverlay()

      // 5. Подключаем поток к видео
      video.srcObject = stream
      await video.play()

      // 6. Читаем реальные параметры
      const track = stream.getVideoTracks()[0]
      readVideoSettings(track)
      updateDebugPanel()

      // 7. Настраиваем фокус (Android)
      await tryEnableContinuousFocus(track)
      startFocusLoop(track)
      updateDebugPanel()

      // 8. Запускаем сканирование
      if (hasNativeBarcodeDetector()) {
        console.log('[useQrCamera] Используем нативный BarcodeDetector')
        await startBarcodeDetectorScan(video)
      } else {
        console.log('[useQrCamera] Используем ZXing (fallback)')
        await startZxingScan(video)
      }

      updateDebugPanel()
    } catch (error) {
      console.error('[useQrCamera] Ошибка запуска камеры:', error)
      isScanning.value = false
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
      stopCameraScan()
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