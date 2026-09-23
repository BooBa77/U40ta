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
 * - Показывает подсказки пользователю на iOS, где автофокус недоступен.
 *
 * @module useQrCamera
 */

import { ref, onUnmounted } from 'vue'

// ZXing — используется как fallback для браузеров без BarcodeDetector
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

// Полифилл BarcodeDetector для iOS/Safari
import { BarcodeDetector } from 'barcode-detector/ponyfill'

/**
 * Создает и управляет оверлеем камеры, запускает сканирование QR-кодов.
 *
 * @param {Object} options - опции
 * @param {Function} options.onScan - колбэк при успешном сканировании
 * @param {Function} [options.onError] - колбэк при ошибке
 * @param {Object} [options.itemInfo] - информация об объекте для заголовка
 * @returns {Object} { startCameraScan, stopCameraScan, isScanning }
 */
export function useQrCamera(options = {}) {
  const { onScan, onError, itemInfo } = options

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

  /**
   * Проверяет, поддерживает ли браузер нативный BarcodeDetector.
   * @returns {boolean}
   */
  const hasNativeBarcodeDetector = () => {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window
  }

  /**
   * Получает список видеоустройств.
   * @returns {Promise<MediaDeviceInfo[]>}
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
   * Выбирает лучшую камеру для сканирования QR-кодов.
   *
   * Логика:
   * 1. Пытаемся найти камеру, которая умеет фокусироваться на близком
   *    расстоянии (минимальный focusDistance в capabilities).
   * 2. Если не удалось — берем заднюю камеру (label содержит "back"
   *    или "rear").
   * 3. Если и это не удалось — берем последнюю камеру в списке
   *    (обычно это основная камера на смартфонах).
   *
   * @returns {Promise<string|null>} deviceId выбранной камеры
   */
  const selectBestCamera = async () => {
    const devices = await getVideoDevices()
    if (devices.length === 0) return null

    // Если камер всего одна — выбирать не из чего
    if (devices.length === 1) return devices[0].deviceId

    // Пытаемся оценить каждую камеру по её возможностям
    const scoredDevices = []

    for (const device of devices) {
      let score = 0
      let capabilities = null

      try {
        // Запрашиваем временный поток, чтобы получить capabilities
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        })
        const track = tempStream.getVideoTracks()[0]
        capabilities = track.getCapabilities ? track.getCapabilities() : {}
        track.stop()
        tempStream.getTracks().forEach((t) => t.stop())
      } catch (error) {
        // Не удалось получить capabilities — пропускаем
        console.warn(
          `[useQrCamera] Не удалось получить capabilities для камеры "${device.label}":`,
          error.message
        )
      }

      // Приоритет 1: камера умеет фокусироваться на близком расстоянии
      if (capabilities && capabilities.focusDistance) {
        const minFocus = capabilities.focusDistance.min || Infinity
        const maxFocus = capabilities.focusDistance.max || 0
        // Чем меньше минимальная дистанция фокусировки — тем лучше
        score += 1000 - minFocus
        // Бонус за широкий диапазон фокусировки
        score += (maxFocus - minFocus) / 10
      }

      // Приоритет 2: задняя камера
      const label = (device.label || '').toLowerCase()
      if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
        score += 500
      }

      // Приоритет 3: камера с большим разрешением (обычно основная)
      if (capabilities && capabilities.width && capabilities.height) {
        score += (capabilities.width.max || 0) / 100
      }

      scoredDevices.push({ device, score, capabilities })
    }

    // Сортируем по убыванию score
    scoredDevices.sort((a, b) => b.score - a.score)

    const best = scoredDevices[0]
    console.log(
      `[useQrCamera] Выбрана камера: "${best.device.label}" (score: ${best.score.toFixed(0)})`
    )

    return best.device.deviceId
  }

  /**
   * Пытается включить непрерывный автофокус на камере (только Android).
   *
   * На iOS этот API недоступен, поэтому функция молча завершится.
   *
   * @param {MediaStreamTrack} track - видео-трек
   */
  const tryEnableContinuousFocus = async (track) => {
    if (!track || !track.applyConstraints) return

    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {}

      // Если камера поддерживает focusMode — включаем continuous
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        })
        console.log('[useQrCamera] Включен непрерывный автофокус')
      }
    } catch (error) {
      // На iOS этот вызов упадет — это нормально
      console.warn('[useQrCamera] Не удалось включить автофокус:', error.message)
    }
  }

  /**
   * Периодически "подталкивает" камеру к фокусировке в центре кадра.
   *
   * Работает только на Android. На iOS — молча ничего не делает.
   * Помогает на устройствах, где автофокус "ленивый" и не хочет
   * фокусироваться сам.
   *
   * @param {MediaStreamTrack} track - видео-трек
   */
  const startFocusLoop = (track) => {
    stopFocusLoop()

    const capabilities = track.getCapabilities ? track.getCapabilities() : {}
    if (!capabilities.focusMode) return

    focusIntervalId = setInterval(async () => {
      try {
        // Переключаемся в single-shot и обратно в continuous —
        // это заставляет камеру перефокусироваться
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

    // Останавливаем интервал сканирования
    if (scanIntervalId) {
      clearInterval(scanIntervalId)
      scanIntervalId = null
    }

    // Останавливаем фокус-луп
    stopFocusLoop()

    // Останавливаем ZXing
    if (zxingControls) {
      try {
        zxingControls.stop()
      } catch (e) {
        // ignore
      }
      zxingControls = null
    }
    zxingReader = null

    // Останавливаем BarcodeDetector (нет метода stop, просто сбрасываем)
    barcodeDetector = null

    // Останавливаем поток камеры
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    // Удаляем видео-элемент
    if (videoElement) {
      videoElement.srcObject = null
      videoElement.remove()
      videoElement = null
    }

    // Удаляем оверлей
    if (overlayElement) {
      overlayElement.remove()
      overlayElement = null
    }

    currentDeviceId = null
  }

  /**
   * Создает DOM-оверлей с видео, кнопкой закрытия и подсказкой.
   *
   * @param {string} deviceLabel - название выбранной камеры (для отладки)
   * @returns {HTMLVideoElement} созданный видео-элемент
   */
  const createOverlay = (deviceLabel = '') => {
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

    // Рамка для наведения на QR-код
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

    // Подсказка для iOS / всех остальных
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
   *
   * @param {HTMLVideoElement} video - видео-элемент
   */
  const startBarcodeDetectorScan = async (video) => {
    // Создаем детектор с нужными форматами
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

    // Проверяем поддержку форматов
    try {
      const supported = await barcodeDetector.getSupportedFormats()
      console.log('[useQrCamera] Поддерживаемые форматы BarcodeDetector:', supported)
    } catch (e) {
      // ignore
    }

    // Запускаем цикл сканирования
    scanIntervalId = setInterval(async () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

      try {
        const barcodes = await barcodeDetector.detect(video)
        if (barcodes.length > 0) {
          const result = barcodes[0].rawValue
          console.log('[useQrCamera] Найден код (BarcodeDetector):', result)
          if (onScan) onScan(result)
          stopCameraScan()
        }
      } catch (error) {
        // Ошибка детекции — игнорируем, продолжаем сканировать
      }
    }, 300)
  }

  /**
   * Запускает сканирование через ZXing (fallback для iOS/Safari).
   *
   * @param {HTMLVideoElement} video - видео-элемент
   * @param {MediaStream} mediaStream - поток камеры
   */
  const startZxingScan = async (video, mediaStream) => {
    // Настраиваем ZXing
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
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
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)

    zxingReader = new BrowserMultiFormatReader(hints)

    // Запускаем декодирование с видео-элемента
    try {
      zxingControls = await zxingReader.decodeFromVideoElement(video, (result, error) => {
        if (result) {
          const text = result.getText()
          console.log('[useQrCamera] Найден код (ZXing):', text)
          if (onScan) onScan(text)
          stopCameraScan()
        }
        // error — это нормально, ZXing кидает NotFoundException на каждый кадр без кода
      })
    } catch (error) {
      console.error('[useQrCamera] Ошибка запуска ZXing:', error)
      if (onError) onError('Ошибка запуска сканера: ' + error.message)
      stopCameraScan()
    }
  }

  /**
   * Запускает камеру и сканирование.
   */
  const startCameraScan = async () => {
    if (isScanning.value) return
    isScanning.value = true

    try {
      // 1. Выбираем лучшую камеру
      currentDeviceId = await selectBestCamera()

      if (!currentDeviceId) {
        throw new Error('Не найдено ни одной камеры на устройстве')
      }

      // 2. Запрашиваем поток
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

      // 3. Создаем оверлей и получаем видео-элемент
      const video = createOverlay()

      // 4. Подключаем поток к видео
      video.srcObject = stream
      await video.play()

      // 5. Настраиваем фокус (только Android)
      const track = stream.getVideoTracks()[0]
      await tryEnableContinuousFocus(track)
      startFocusLoop(track)

      // 6. Запускаем сканирование
      if (hasNativeBarcodeDetector()) {
        console.log('[useQrCamera] Используем нативный BarcodeDetector')
        await startBarcodeDetectorScan(video)
      } else {
        console.log('[useQrCamera] Используем ZXing (fallback)')
        await startZxingScan(video, stream)
      }
    } catch (error) {
      console.error('[useQrCamera] Ошибка запуска камеры:', error)
      isScanning.value = false

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

  // Очистка при размонтировании компонента
  onUnmounted(() => {
    stopCameraScan()
  })

  return {
    startCameraScan,
    stopCameraScan,
    isScanning
  }
}