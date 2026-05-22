/**
 * Хук для загрузки данных ведомости с сервера или из кэша
 * Отвечает только за получение сырых данных, без обработки и группировки
 * Вся логика агрегации, сортировки и определения цветов вынесена в useStatementAggregation
 * 
 * @param {string|number} attachmentId - ID вложения email
 * @returns {Object} Состояния и методы для работы с данными ведомости
 */
import { ref, onUnmounted } from 'vue'
import { statementService } from '@/services/statement.service'
import { useRouter } from 'vue-router'
import { useSSE } from '@/composables/useSSE'

export function useStatementData(attachmentId) {
  // Состояния
  const loading = ref(true)
  const error = ref(null)
  const statements = ref([]) // Сырые данные без обработки
  const router = useRouter()

  /**
   * Проверяет, активен ли режим полёта (офлайн-режим)
   * @returns {boolean} true если режим полёта включен
   */
  const isFlightMode = () => {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Загружает данные ведомости
   * Получает сырые данные от сервиса без дополнительной обработки
   * @returns {Promise<void>}
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      const data = await statementService.fetchStatement(attachmentId)
      // Сохраняем сырые данные - группировка и сортировка будут в useStatementAggregation
      statements.value = data
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки ведомости'
      console.error('[useStatementData] Ошибка:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Перезагружает данные ведомости
   * Вызывается после обновлений (изменение isActual, создание объекта и т.д.)
   * @returns {Promise<void>}
   */
  const reload = () => {
    return loadData()
  }

  /**
   * Обработчик SSE сообщений для real-time обновлений
   * @param {Object} data - сообщение от SSE
   * @param {string} data.type - тип события
   * @param {Object} data.data - данные события
   * @returns {void}
   */
  const handleSSEMessage = (data) => {
    switch (data.type) {
      case 'statement-updated':
        // Обновление данных ведомости
        if (data.data?.attachmentId !== Number(attachmentId)) return
        console.log(`SSE: Ведомость ${attachmentId} обновлена, перезагружаем`)
        reload()
        break
        
      case 'statement-active-changed':
        // Смена активной ведомости другим пользователем
        if (data.data?.attachmentId === Number(attachmentId)) return
        console.log(`SSE: Ведомость стала активной у другого пользователя`)
        router.push('/')
        break
        
      case 'statement-deleted':
        // Удаление ведомости
        if (data.data?.attachmentId !== Number(attachmentId)) return
        console.log(`SSE: Ведомость ${attachmentId} удалена`)
        router.push('/')
        break
    }
  }

  // Подключаем SSE через композабл (автоподключение только если не в офлайн-режиме)
  const { disconnect: disconnectSSE } = useSSE(handleSSEMessage, { 
    autoConnect: !isFlightMode() 
  })

  // Автоматическая загрузка при инициализации
  loadData()

  // Закрываем соединение при размонтировании компонента
  onUnmounted(() => {
    disconnectSSE()
  })

  return {
    // Состояния
    loading,      // Флаг загрузки
    error,        // Ошибка загрузки
    statements,   // Сырые данные ведомости (без обработки)
    
    // Методы
    reload        // Перезагрузка данных
  }
}