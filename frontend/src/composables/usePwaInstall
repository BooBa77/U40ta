import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Композабл для управления установкой PWA.
 * 
 * Слушатель beforeinstallprompt регистрируется один раз при первом вызове.
 * Состояние showInstall доступно реактивно во всех компонентах.
 * В офлайн-режиме кнопка установки скрывается.
 */
const showInstall = ref(false)
let deferredPrompt = null
let isInitialized = false

export function usePwaInstall() {
  const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

  /**
   * Проверяет, можно ли показывать кнопку установки.
   * Условия: онлайн, не Flight Mode, не установлено как PWA, есть deferredPrompt.
   */
  const checkAvailability = () => {
    const isFlightMode = localStorage.getItem(FLIGHT_MODE_KEY) === 'true'
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    
    if (!navigator.onLine || isFlightMode || isStandalone || !deferredPrompt) {
      showInstall.value = false
      return
    }
    
    showInstall.value = true
  }

  /**
   * Инициализация слушателя beforeinstallprompt.
   * Вызывается один раз за жизнь приложения.
   */
  const init = () => {
    if (isInitialized) return
    isInitialized = true

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      checkAvailability()
    })

    window.addEventListener('appinstalled', () => {
      showInstall.value = false
      deferredPrompt = null
    })

    window.addEventListener('online', checkAvailability)
    window.addEventListener('offline', () => {
      showInstall.value = false
    })

    window.addEventListener('flight-mode-changed', (event) => {
      if (event.detail.isFlightMode) {
        showInstall.value = false
      } else {
        checkAvailability()
      }
    })

    window.addEventListener('storage', (event) => {
      if (event.key === FLIGHT_MODE_KEY) {
        checkAvailability()
      }
    })
  }

  /**
   * Вызов окна установки PWA.
   */
  const install = () => {
    const isFlightMode = localStorage.getItem(FLIGHT_MODE_KEY) === 'true'
    
    if (deferredPrompt && navigator.onLine && !isFlightMode) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showInstall.value = false
        }
        deferredPrompt = null
      })
    }
  }

  // Автоинициализация при первом вызове
  init()

  return {
    showInstall,
    install
  }
}