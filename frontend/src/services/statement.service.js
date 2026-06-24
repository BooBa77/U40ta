/**
 * Сервис для работы с ведомостями МОЛ (statements).
 * Поддерживает онлайн/офлайн режимы работы.
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache.service'

export class StatementService {
  constructor() {
    this.baseUrl = '/api'
  }

  //============================================================================
  // БАЗОВЫЕ МЕТОДЫ
  //============================================================================

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean} true если режим полёта включен
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для запросов к API
   * @param {string} endpoint - API endpoint (без /api/)
   * @param {Object} options - Параметры запроса
   * @returns {Promise<any>} Ответ от сервера
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    const defaultOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    }

    if (requestOptions.body && typeof requestOptions.body !== 'string') {
      requestOptions.body = JSON.stringify(requestOptions.body)
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions)

    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`)
    }

    return await response.json()
  }

  //============================================================================
  // СПИСОК ВЕДОМОСТЕЙ
  //============================================================================

  /**
   * Получает список ведомостей текущего МОЛ.
   * GET /api/statements
   * @returns {Promise<Array>} Массив ведомостей { receivedAt, description, docType, count }
   */
  async getList() {
    if (this.isFlightMode()) {
      console.log('[StatementService] Офлайн-режим: получение списка ведомостей из кэша')
      return this.getListFromCache()
    }

    console.log('[StatementService] Онлайн-режим: получение списка ведомостей с сервера')
    return this.getListFromApi()
  }

  /**
   * Получает список ведомостей из кэша IndexedDB.
   * Группирует по receivedAt + description.
   * @returns {Promise<Array>}
   */
  async getListFromCache() {
    try {
      const allStatements = await offlineCache.getAllStatements()
      
      const groups = new Map()
      for (const s of allStatements) {
        const key = `${s.receivedAt}_${s.description}`
        if (!groups.has(key)) {
          groups.set(key, {
            receivedAt: s.receivedAt,
            description: s.description,
            docType: s.docType,
            count: 0
          })
        }
        groups.get(key).count++
      }
      
      const list = Array.from(groups.values())
        .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
      
      console.log(`[StatementService] Из кэша получено ведомостей: ${list.length}`)
      return list
    } catch (error) {
      console.error('[StatementService] Ошибка получения списка из кэша:', error)
      throw new Error('Не удалось загрузить список ведомостей из кэша')
    }
  }

  /**
   * Получает список ведомостей с сервера.
   * @returns {Promise<Array>}
   */
  async getListFromApi() {
    try {
      const data = await this.apiRequest('/statements')
      
      if (!Array.isArray(data)) {
        throw new Error('Неожиданный формат ответа API для списка ведомостей')
      }
      
      return data
    } catch (error) {
      console.error('[StatementService] Ошибка получения списка с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // СТРОКИ ВЕДОМОСТИ
  //============================================================================

  /**
   * Получает строки конкретной ведомости.
   * GET /api/statements/items?receivedAt=...
   * @param {string} receivedAt - дата получения ведомости в ISO формате
   * @returns {Promise<Array>} Массив записей ведомости с полем objectCount
   */
  async getItems(receivedAt) {
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: получение строк ведомости ${receivedAt} из кэша`)
      return this.getItemsFromCache(receivedAt)
    }

    console.log(`[StatementService] Онлайн-режим: получение строк ведомости ${receivedAt} с сервера`)
    return this.getItemsFromApi(receivedAt)
  }

  /**
   * Получает строки ведомости из кэша IndexedDB.
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<Array>}
   */
  async getItemsFromCache(receivedAt) {
    try {
      // 1. Получаем строки ведомости из кэша
      const statements = await offlineCache.getStatementsByReceivedAt(receivedAt)
      
      // 2. Собираем уникальные zavod + sklad
      const skladPairs = new Map()
      for (const row of statements) {
        const key = `${row.zavod}|${row.sklad}`
        if (!skladPairs.has(key)) {
          skladPairs.set(key, { zavod: row.zavod, sklad: row.sklad })
        }
      }

      // 3. Для каждой пары получаем объекты и считаем objectCount
      for (const [key, { zavod, sklad }] of skladPairs) {
        const objects = await offlineCache.findObjectsByZavodSklad(zavod, sklad)
        
        // Группируем объекты по invNumber + partyNumber
        const objectCounts = new Map()
        for (const obj of objects) {
          const objKey = `${obj.invNumber}|${obj.partyNumber || ''}`
          objectCounts.set(objKey, (objectCounts.get(objKey) || 0) + 1)
        }

        // Проставляем objectCount для каждой строки statements
        for (const row of statements) {
          if (row.zavod === zavod && row.sklad === sklad) {
            const rowKey = `${row.invNumber}|${row.partyNumber || ''}`
            row.objectCount = objectCounts.get(rowKey) || 0
          }
        }
      }

      console.log(`[StatementService] Из кэша получено записей: ${statements.length}`)
      return statements
    } catch (error) {
      console.error('[StatementService] Ошибка получения строк из кэша:', error)
      throw new Error('Не удалось загрузить строки ведомости из кэша')
    }
  }

  /**
   * Получает строки ведомости с сервера.
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<Array>}
   */
  async getItemsFromApi(receivedAt) {
    try {
      const params = new URLSearchParams()
      params.append('receivedAt', receivedAt)

      const data = await this.apiRequest(`/statements/items?${params.toString()}`)
      
      if (data.statements && Array.isArray(data.statements)) {
        return data.statements
      }
      
      throw new Error('Неожиданный формат ответа API для строк ведомости')
    } catch (error) {
      console.error('[StatementService] Ошибка получения строк с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // УДАЛЕНИЕ ВЕДОМОСТИ
  //============================================================================

  /**
   * Удаляет ведомость.
   * DELETE /api/statements?receivedAt=...
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteStatement(receivedAt) {
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: удаление ведомости ${receivedAt} из кэша`)
      return this.deleteStatementFromCache(receivedAt)
    }

    console.log(`[StatementService] Онлайн-режим: удаление ведомости ${receivedAt}`)
    return this.deleteStatementFromApi(receivedAt)
  }

  /**
   * Удаляет ведомость из кэша IndexedDB.
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<Object>}
   */
  async deleteStatementFromCache(receivedAt) {
    try {
      const count = await offlineCache.deleteStatementsByReceivedAt(receivedAt)
      console.log(`[StatementService] Из кэша удалено записей: ${count}`)
      return { success: true, message: 'Ведомость удалена' }
    } catch (error) {
      console.error('[StatementService] Ошибка удаления из кэша:', error)
      throw new Error('Не удалось удалить ведомость из кэша')
    }
  }

  /**
   * Удаляет ведомость через API.
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<Object>}
   */
  async deleteStatementFromApi(receivedAt) {
    try {
      const params = new URLSearchParams()
      params.append('receivedAt', receivedAt)

      return await this.apiRequest(`/statements?${params.toString()}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('[StatementService] Ошибка удаления через API:', error)
      throw error
    }
  }

  //============================================================================
  // ОБНОВЛЕНИЕ СТАТУСА АКТУАЛЬНОСТИ (isActual)
  //============================================================================

  /**
   * Обновляет статус isActual для всех записей с указанным invNumber в ведомости.
   * POST /api/statements/update-actual
   * @param {string} receivedAt - дата получения ведомости
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение актуальности
   * @returns {Promise<boolean>} true если успешно
   */
  async updateActualStatus(receivedAt, invNumber, isActual) {
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: обновление isActual для ${invNumber} в ведомости ${receivedAt}`)
      return this.updateActualInCache(receivedAt, invNumber, isActual)
    }

    console.log(`[StatementService] Онлайн-режим: обновление isActual для ${invNumber} в ведомости ${receivedAt}`)
    return this.updateActualInApi(receivedAt, invNumber, isActual)
  }

  /**
   * Обновляет isActual в кэше IndexedDB.
   * @param {string} receivedAt - дата получения ведомости
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение
   * @returns {Promise<boolean>}
   */
  async updateActualInCache(receivedAt, invNumber, isActual) {
    try {
      await offlineCache.updateStatementsActualByInv(receivedAt, invNumber, isActual)
      console.log(`[StatementService] Обновлены записи: receivedAt=${receivedAt}, invNumber=${invNumber}, isActual=${isActual}`)
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления isActual в кэше:', error)
      throw new Error('Не удалось обновить статус актуальности в кэше')
    }
  }

  /**
   * Обновляет isActual через API.
   * @param {string} receivedAt - дата получения ведомости
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение
   * @returns {Promise<boolean>}
   */
  async updateActualInApi(receivedAt, invNumber, isActual) {
    try {
      await this.apiRequest('/statements/update-actual', {
        method: 'POST',
        body: { receivedAt, invNumber, isActual }
      })
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления isActual через API:', error)
      throw error
    }
  }

  //============================================================================
  // ПОИСК ЗАПИСЕЙ ПО ИНВЕНТАРНОМУ НОМЕРУ
  //============================================================================

  /**
   * Получает записи ведомости по инвентарному номеру (для InvListModal).
   * GET /api/statements/by-inv?inv=...&receivedAt=...&zavod=...&sklad=...&party=...
   * @param {string} inv - инвентарный номер
   * @param {string} [partyNumber] - партия объекта
   * @param {string} [receivedAt] - дата получения ведомости (для ограничения текущей ведомостью)
   * @param {number} [zavod] - номер завода
   * @param {string} [sklad] - код склада
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getStatementsByInv(receivedAt, inv, partyNumber, zavod, sklad) {
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: поиск записей по inv=${inv}`)
      return this.getStatementsByInvFromCache(inv, partyNumber, receivedAt, zavod, sklad)
    }

    console.log(`[StatementService] Онлайн-режим: поиск записей по inv=${inv}`)
    return this.getStatementsByInvFromApi(inv, partyNumber, receivedAt, zavod, sklad)
  }

  /**
   * Поиск записей ведомости в кэше IndexedDB.
   * @param {string} inv - инвентарный номер
   * @param {string} [partyNumber] - партия объекта
   * @param {string} [receivedAt] - дата получения ведомости
   * @param {number} [zavod] - номер завода
   * @param {string} [sklad] - код склада
   * @returns {Promise<Array>}
   */
  async getStatementsByInvFromCache(inv, partyNumber, receivedAt, zavod, sklad) {
    try {
      let statements = await offlineCache.getStatementsByInv(inv, partyNumber, zavod, sklad)
      
      // Фильтруем по receivedAt если передан
      if (receivedAt) {
        statements = statements.filter(s => s.receivedAt === receivedAt)
      }
      
      console.log(`[StatementService] Из кэша найдено записей: ${statements.length}`)
      return statements
    } catch (error) {
      console.error('[StatementService] Ошибка поиска в кэше:', error)
      return []
    }
  }

  /**
   * Поиск записей ведомости через API.
   * @param {string} inv - инвентарный номер
   * @param {string} [partyNumber] - партия объекта
   * @param {string} [receivedAt] - дата получения ведомости
   * @param {number} [zavod] - номер завода
   * @param {string} [sklad] - код склада
   * @returns {Promise<Array>}
   */
  async getStatementsByInvFromApi(inv, partyNumber, receivedAt, zavod, sklad) {
    try {
      const params = new URLSearchParams()
      params.append('inv', inv)
      
      if (receivedAt !== undefined && receivedAt !== null) {
        params.append('receivedAt', receivedAt)
      }
      
      if (partyNumber !== undefined && partyNumber !== null && partyNumber !== '') {
        params.append('party', partyNumber)
      }
      
      if (zavod !== undefined && zavod !== null) {
        params.append('zavod', zavod)
      }
      
      if (sklad !== undefined && sklad !== null) {
        params.append('sklad', sklad)
      }

      const data = await this.apiRequest(`/statements/by-inv?${params.toString()}`)
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка поиска записей')
      }
      
      return data.statements || []
    } catch (error) {
      console.error('[StatementService] Ошибка поиска через API:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const statementService = new StatementService()