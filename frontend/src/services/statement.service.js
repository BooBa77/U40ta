/**
 * Сервис для работы с ведомостями (statements)
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

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

    // Базовые настройки для всех запросов
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }

    // Объединяем с переданными опциями
    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    }

    // Для методов с телом (POST, PUT) преобразуем объект в JSON
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
  // ПОЛУЧЕНИЕ ВЕДОМОСТИ ПО ID ВЛОЖЕНИЯ
  //============================================================================

  /**
   * Получает ведомость по ID вложения email
   * @param {string|number} emailAttachmentId - ID вложения email
   * @returns {Promise<Array>} Массив объектов ведомости
   */
  async fetchStatement(emailAttachmentId) {
    const attachmentId = Number(emailAttachmentId)

    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: получение ведомости ${attachmentId} из кэша`)
      return this.getFromCache(attachmentId)
    }

    console.log(`[StatementService] Онлайн-режим: получение ведомости ${attachmentId} с сервера`)
    return this.getFromApi(attachmentId)
  }

  /**
   * Получает ведомость из кэша IndexedDB
   * @param {number} attachmentId - ID вложения email
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getFromCache(attachmentId) {
    try {
      const statements = await offlineCache.getProcessedStatementsByAttachmentId(attachmentId)
      console.log(`[StatementService] Из кэша получено записей: ${statements.length}`)
      return statements
    } catch (error) {
      console.error('[StatementService] Ошибка получения из кэша:', error)
      throw new Error('Не удалось загрузить ведомость из кэша')
    }
  }

  /**
   * Получает ведомость с сервера через API
   * @param {number} attachmentId - ID вложения email
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getFromApi(attachmentId) {
    try {
      const data = await this.apiRequest(`/statements/${attachmentId}`)
      
      // API возвращает { success: true, statements: [...] }
      if (data.statements && Array.isArray(data.statements)) {
        return data.statements
      }
      
      throw new Error(`Неожиданный формат ответа API для ведомости ${attachmentId}`)
    } catch (error) {
      console.error('[StatementService] Ошибка получения с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // ОБНОВЛЕНИЕ СТАТУСА haveObject
  //============================================================================

  /**
   * Обновляет статус haveObject для записи ведомости
   * @param {number} statementId - ID записи ведомости
   * @param {boolean} haveObject - Новое значение haveObject
   * @returns {Promise<boolean>} true если успешно
   */
  async updateStatementHaveObject(statementId, haveObject) {
    const statementIdNum = Number(statementId)

    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: обновление haveObject для записи ${statementIdNum}`)
      return this.updateHaveObjectInCache(statementIdNum, haveObject)
    }

    console.log(`[StatementService] Онлайн-режим: обновление haveObject для записи ${statementIdNum}`)
    return this.updateHaveObjectInApi(statementIdNum, haveObject)
  }

  /**
   * Обновляет haveObject в кэше IndexedDB
   * @param {number} statementId - ID записи ведомости
   * @param {boolean} haveObject - Новое значение
   * @returns {Promise<boolean>}
   */
  async updateHaveObjectInCache(statementId, haveObject) {
    try {
      await offlineCache.updateProcessedStatementHaveObject(statementId, haveObject)
      console.log(`[StatementService] Запись ${statementId} обновлена: haveObject=${haveObject}`)
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить запись ведомости в кэше')
    }
  }

  /**
   * Обновляет haveObject через API
   * @param {number} statementId - ID записи ведомости
   * @param {boolean} haveObject - Новое значение
   * @returns {Promise<boolean>}
   */
  async updateHaveObjectInApi(statementId, haveObject) {
    try {
      await this.apiRequest('/statements/update-have-object', {
        method: 'POST',
        body: { statementId, haveObject }
      })
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления через API:', error)
      throw error
    }
  }

  //============================================================================
  // ОБНОВЛЕНИЕ СТАТУСА АКТУАЛЬНОСТИ (isActual)
  //============================================================================

  /**
   * Обновляет статус isActual для всех записей с указанным inv_number в рамках ведомости
   * @param {number} attachmentId - ID вложения email
   * @param {string} invNumber - Инвентарный номер
   * @param {boolean} isActual - Новое значение актуальности (true - актуально, false - неактуально)
   * @returns {Promise<boolean>} true если успешно
   */
  async updateActualStatus(attachmentId, invNumber, isActual) {
    const attachmentIdNum = Number(attachmentId)

    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: обновление isActual для ${invNumber} в ведомости ${attachmentIdNum}`)
      return this.updateActualInCache(attachmentIdNum, invNumber, isActual)
    }

    console.log(`[StatementService] Онлайн-режим: обновление isActual для ${invNumber} в ведомости ${attachmentIdNum}`)
    return this.updateActualInApi(attachmentIdNum, invNumber, isActual)
  }

  /**
   * Обновляет isActual в кэше IndexedDB для всех записей с указанным inv_number
   * @param {number} attachmentId - ID вложения email
   * @param {string} invNumber - Инвентарный номер
   * @param {boolean} isActual - Новое значение актуальности
   * @returns {Promise<boolean>}
   */
  async updateActualInCache(attachmentId, invNumber, isActual) {
    try {
      await offlineCache.updateProcessedStatementsActualByInv(attachmentId, invNumber, isActual)
      console.log(`[StatementService] Обновлены записи: attachmentId=${attachmentId}, invNumber=${invNumber}, isActual=${isActual}`)
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления isActual в кэше:', error)
      throw new Error('Не удалось обновить статус актуальности в кэше')
    }
  }

  /**
   * Обновляет isActual через API для всех записей с указанным inv_number
   * @param {number} attachmentId - ID вложения email
   * @param {string} invNumber - Инвентарный номер
   * @param {boolean} isActual - Новое значение актуальности
   * @returns {Promise<boolean>}
   */
  async updateActualInApi(attachmentId, invNumber, isActual) {
    try {
      console.log('[StatementService] Отправка запроса:', { attachmentId, invNumber, isActual })
      
      await this.apiRequest('/statements/update-actual', {
        method: 'POST',
        body: { attachmentId, invNumber, isActual }
      })
      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления isActual через API:', error)
      throw error
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ЗАПИСЕЙ ПО ИНВЕНТАРНОМУ НОМЕРУ
  //============================================================================

  /**
   * Получает записи ведомости по инвентарному номеру и партии (для ObjectViewModal)
   * Возвращает только записи с haveObject = false (объект ещё не создан)
   * @param {string} inv - Инвентарный номер
   * @param {string} [partyNumber] - Партия объекта
   * @param {number} [zavod] - Номер завода (опционально)
   * @param {string} [sklad] - Код склада (опционально)
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getStatementsByInv(inv, partyNumber, zavod, sklad) {
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: поиск записей по inv=${inv}, party=${partyNumber}`)
      return this.getStatementsByInvFromCache(inv, partyNumber, zavod, sklad)
    }

    console.log(`[StatementService] Онлайн-режим: поиск записей по inv=${inv}, party=${partyNumber}`)
    return this.getStatementsByInvFromApi(inv, partyNumber, zavod, sklad)
  }

  /**
   * Поиск записей ведомости в кэше IndexedDB
   * @param {string} inv - Инвентарный номер
   * @param {string} [partyNumber] - Партия объекта
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>}
   */
  async getStatementsByInvFromCache(inv, partyNumber, zavod, sklad) {
    try {
      const statements = await offlineCache.getProcessedStatementsByInv(inv, partyNumber, zavod, sklad)
      console.log(`[StatementService] Из кэша найдено записей: ${statements.length}`)
      return statements
    } catch (error) {
      console.error('[StatementService] Ошибка поиска в кэше:', error)
      return []
    }
  }

  /**
   * Поиск записей ведомости через API
   * @param {string} inv - Инвентарный номер
   * @param {string} [partyNumber] - Партия объекта
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>}
   */
  async getStatementsByInvFromApi(inv, partyNumber, zavod, sklad) {
    try {
      const params = new URLSearchParams()
      params.append('inv', inv)
      
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