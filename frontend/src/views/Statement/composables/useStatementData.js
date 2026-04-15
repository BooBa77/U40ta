/**
 * Хук для загрузки данных ведомости с сортировкой по группам
 * @param {string|number} attachmentId - ID вложения email
 * @returns {Object} Состояния и методы для работы с данными ведомости
 */
import { ref, onUnmounted } from 'vue'
import { statementService } from '@/services/statement.service'
import { useRouter } from 'vue-router'

export function useStatementData(attachmentId) {
  // Состояния
  const loading = ref(true)
  const error = ref(null)
  const statements = ref([])
  const router = useRouter()
  const eventSource = ref(null)
  let reconnectTimeout = null

  /**
   * Проверяет, активен ли режим полёта
   */
  const isFlightMode = () => {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Определяет группу строки для сортировки и окраски
   */
  const getRowGroup = (row) => {
    const haveObject = row.have_object ?? row.haveObject
    const isExcess = row.is_excess ?? row.isExcess
    const isIgnore = row.is_ignore ?? row.isIgnore
    
    if (isIgnore === true) return 4
    if (haveObject === false) return 1
    if (isExcess === true) return 2
    return 3
  }

  /**
   * Сортирует statements по группам и наименованию
   */
  const sortStatements = (statementsArray) => {
    return [...statementsArray].sort((a, b) => {
      const groupA = getRowGroup(a)
      const groupB = getRowGroup(b)
      
      if (groupA !== groupB) {
        return groupA - groupB
      }
      
      const nameA = (a.buh_name ?? a.buhName ?? '').toLowerCase()
      const nameB = (b.buh_name ?? b.buhName ?? '').toLowerCase()
      
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB)
      }
      
      const invA = (a.inv_number ?? a.invNumber ?? '').toLowerCase()
      const invB = (b.inv_number ?? b.invNumber ?? '').toLowerCase()
      const partyA = (a.party_number ?? a.partyNumber ?? '').toLowerCase()
      const partyB = (b.party_number ?? b.partyNumber ?? '').toLowerCase()
      
      if (invA !== invB) {
        return invA.localeCompare(invB)
      }
      
      return partyA.localeCompare(partyB)
    })
  }

  /**
   * Загружает данные ведомости
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      const data = await statementService.fetchStatement(attachmentId)
      statements.value = sortStatements(data)
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки ведомости'
      console.error('[useStatementData] Ошибка:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Перезагружает данные
   */
  const reload = () => {
    loadData()
  }

  /**
   * Закрывает SSE соединение
   */
  const disconnectSSE = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      console.log('[useStatementData] SSE соединение закрыто')
    }
  }

  /**
   * Подключается к SSE (только в онлайн-режиме)
   */
  const connectToSSE = () => {
    // Закрываем существующее соединение
    disconnectSSE()

    // Не подключаемся в офлайн-режиме
    if (isFlightMode()) {
      console.log('[useStatementData] Офлайн-режим, SSE не подключается')
      return
    }

    console.log('[useStatementData] Подключение к SSE для ведомости', attachmentId)
    
    const sseUrl = '/api/app-events/sse'
    eventSource.value = new EventSource(sseUrl)
    
    eventSource.value.addEventListener('open', () => {
      console.log('[useStatementData] SSE соединение установлено')
    })
    
    eventSource.value.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'statement-updated':
            if (data.data?.attachmentId !== Number(attachmentId)) return
            console.log(`[useStatementData] SSE: ведомость ${attachmentId} обновлена, перезагружаем`)
            reload()
            break
            
          case 'statement-active-changed':
            if (data.data?.attachmentId === Number(attachmentId)) return
            console.log(`[useStatementData] SSE: ведомость стала активной у другого пользователя`)
            router.push('/')
            break
            
          case 'statement-deleted':
            if (data.data?.attachmentId !== Number(attachmentId)) return
            console.log(`[useStatementData] SSE: ведомость ${attachmentId} удалена`)
            router.push('/')
            break
        }
      } catch (parseError) {
        console.error('[useStatementData] Ошибка парсинга SSE события:', parseError)
      }
    })
    
    eventSource.value.addEventListener('error', () => {
      console.log('[useStatementData] SSE соединение разорвано')
      disconnectSSE()
      
      // Пытаемся переподключиться через 10 секунд, если не в офлайн-режиме
      if (!isFlightMode()) {
        reconnectTimeout = setTimeout(() => {
          connectToSSE()
        }, 10000)
      }
    })
  }

  /**
   * Обработчик изменения режима полёта
   */
  const handleFlightModeChange = (event) => {
    if (event.detail.isFlightMode) {
      // При переходе в офлайн - закрываем SSE
      disconnectSSE()
    } else {
      // При переходе в онлайн - подключаем SSE
      connectToSSE()
    }
  }

  // Подписываемся на события изменения режима полёта
  window.addEventListener('flight-mode-changed', handleFlightModeChange)

  // Автоматическая загрузка при инициализации
  loadData()

  // Подключаем SSE после загрузки данных
  setTimeout(() => {
    connectToSSE()
  }, 100)

  // Закрываем соединение при размонтировании компонента
  onUnmounted(() => {
    disconnectSSE()
    window.removeEventListener('flight-mode-changed', handleFlightModeChange)
  })

  return {
    loading,
    error,
    statements,
    reload,
    getRowGroup
  }
}