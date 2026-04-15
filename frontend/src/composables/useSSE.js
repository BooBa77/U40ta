import { ref, onUnmounted } from 'vue'

/**
 * Композабл для управления SSE соединением
 * @param {Function} onMessage - обработчик входящих сообщений (получает распарсенный data)
 * @param {Object} options - опции
 * @param {boolean} options.autoConnect - автоматически подключаться при создании (по умолчанию true)
 * @returns {Object} { connect, disconnect, isConnected }
 */
export function useSSE(onMessage, options = { autoConnect: true }) {
  const eventSource = ref(null)
  const isConnected = ref(false)
  let reconnectTimeout = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5

  const isFlightMode = () => {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      isConnected.value = false
      console.log('[useSSE] Соединение закрыто')
    }
  }

  const connect = () => {
    // Закрываем существующее соединение
    disconnect()
    
    // Не подключаемся в офлайн-режиме
    if (isFlightMode()) {
      console.log('[useSSE] Офлайн-режим, SSE не подключается')
      return
    }

    console.log('[useSSE] Подключение к SSE...')
    eventSource.value = new EventSource('/api/app-events/sse')
    
    eventSource.value.onopen = () => {
      console.log('[useSSE] Соединение установлено')
      isConnected.value = true
      reconnectAttempts = 0
    }
    
    eventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        console.error('[useSSE] Ошибка парсинга:', error)
      }
    }
    
    eventSource.value.onerror = () => {
      console.log('[useSSE] Соединение разорвано')
      disconnect()
      
      // Переподключение с ограничением попыток
      if (!isFlightMode() && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        const delay = Math.min(10000 * reconnectAttempts, 30000)
        console.log(`[useSSE] Попытка переподключения ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} через ${delay}мс`)
        reconnectTimeout = setTimeout(connect, delay)
      }
    }
  }

  // Обработчик изменения режима полёта
  const handleFlightModeChange = (event) => {
    if (event.detail.isFlightMode) {
      disconnect()
    } else {
      connect()
    }
  }

  // Подписываемся на события режима полёта
  window.addEventListener('flight-mode-changed', handleFlightModeChange)

  // Автоматическое подключение
  if (options.autoConnect) {
    connect()
  }

  // Очистка при размонтировании
  onUnmounted(() => {
    disconnect()
    window.removeEventListener('flight-mode-changed', handleFlightModeChange)
  })

  return {
    connect,
    disconnect,
    isConnected
  }
}