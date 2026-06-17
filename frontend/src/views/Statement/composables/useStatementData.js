/**
 * Хук для загрузки данных ведомости с сервера или из кэша.
 * После загрузки строк вычисляет isExcess — объекты на складах ведомости,
 * которые отсутствуют в statements.
 * Подписывается на SSE-событие objects-changed для обновления при изменении объектов.
 * 
 * @param {string} receivedAt - дата получения ведомости в ISO формате
 * @returns {Object} Состояния и методы для работы с данными ведомости
 */
import { ref, onUnmounted } from 'vue'
import { statementService } from '@/services/statement.service'
import { objectService } from '@/services/object-service'
import { useSSE } from '@/composables/useSSE'

export function useStatementData(receivedAt) {
  const loading = ref(true)
  const error = ref(null)
  const statements = ref([])

  /**
   * Проверяет, активен ли режим полёта.
   * @returns {boolean}
   */
  const isFlightMode = () => {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Загружает строки ведомости и добавляет виртуальные isExcess строки.
   * @returns {Promise<void>}
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      // 1. Получаем строки ведомости (с objectCount)
      const data = await statementService.getItems(receivedAt)
      
      // 2. Собираем уникальные zavod + sklad
      const skladPairs = new Map()
      for (const row of data) {
        const key = `${row.zavod}|${row.sklad}`
        if (!skladPairs.has(key)) {
          skladPairs.set(key, { zavod: row.zavod, sklad: row.sklad })
        }
      }

      // 3. Для каждой пары получаем все объекты и считаем isExcess
      const excessRows = []
      
      for (const [key, { zavod, sklad }] of skladPairs) {
        const objects = await objectService.getObjectsBySklad(zavod, sklad)
        
        // Группируем объекты по invNumber + partyNumber
        const objectCounts = new Map()
        for (const obj of objects) {
          const objKey = `${obj.invNumber}|${obj.partyNumber || ''}`
          objectCounts.set(objKey, (objectCounts.get(objKey) || 0) + 1)
        }

        // Группируем строки statements по invNumber + partyNumber
        const statementCounts = new Map()
        for (const row of data) {
          if (row.zavod !== zavod || row.sklad !== sklad) continue
          const stKey = `${row.invNumber}|${row.partyNumber || ''}`
          statementCounts.set(stKey, (statementCounts.get(stKey) || 0) + 1)
        }

        // Находим объекты, которых больше чем строк statements
        for (const [objKey, objCount] of objectCounts) {
          const stCount = statementCounts.get(objKey) || 0
          const delta = objCount - stCount
          
          if (delta > 0) {
            const [invNumber, partyNumber] = objKey.split('|')
            
            // Берём buhName из первого попавшегося объекта с этим ключом
            const sampleObj = objects.find(
              o => o.invNumber === invNumber && (o.partyNumber || '') === partyNumber
            )
            
            for (let i = 0; i < delta; i++) {
              excessRows.push({
                id: `excess_${objKey}_${i}`,
                zavod,
                sklad,
                invNumber,
                partyNumber: partyNumber || null,
                buhName: sampleObj?.buhName || 'Объект отсутствует в ведомости',
                isActual: true,
                isExcess: true,
                objectCount: objCount
              })
            }
          }
        }
      }

      // 4. Объединяем строки ведомости с isExcess
      statements.value = [...data, ...excessRows]
      
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки ведомости'
      console.error('[useStatementData] Ошибка:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Перезагружает данные ведомости.
   * @returns {Promise<void>}
   */
  const reload = () => {
    return loadData()
  }

  /**
   * Обработчик SSE-событий.
   * Реагирует на objects-changed — если объекты изменились на складе,
   * который есть в текущей ведомости, делает reload().
   * Свои собственные изменения игнорирует (userId совпадает).
   * 
   * @param {Object} data - данные SSE-события
   */
  const handleSSEMessage = (data) => {
    if (data.type !== 'objects-changed') return
    
    const { userId, zavod, sklad } = data.data || {}
    
    // Игнорируем свои изменения
    const token = localStorage.getItem('auth_token')
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1]
        const payloadJson = atob(payloadBase64)
        const payload = JSON.parse(payloadJson)
        if (payload.sub === userId) return
      } catch (e) {
        // Не удалось распарсить токен — на всякий случай reload
      }
    }

    // Проверяем, есть ли этот склад в текущей ведомости
    const hasSklad = statements.value.some(
      row => row.zavod === zavod && row.sklad === sklad
    )
    
    if (hasSklad) {
      console.log(`[useStatementData] SSE: объекты изменились на складе ${sklad}, перезагружаем`)
      reload()
    }
  }

  // Подключаем SSE (только онлайн)
  const { disconnect: disconnectSSE } = useSSE(handleSSEMessage, { 
    autoConnect: !isFlightMode() 
  })

  // Загрузка данных
  loadData()

  // Очистка при размонтировании
  onUnmounted(() => {
    disconnectSSE()
  })

  return {
    loading,
    error,
    statements,
    reload
  }
}