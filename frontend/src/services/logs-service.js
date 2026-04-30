/**
 * Сервис для работы с универсальными логами.
 * Поддерживает онлайн/офлайн режимы работы.
 *
 * Онлайн (flightMode = false): все запросы к API.
 * Офлайн (flightMode = true): все операции в IndexedDB.
 *
 * Соглашение об именовании:
 * - Фронтовый код и API общаются в camelCase.
 * - IndexedDB хранит данные в camelCase.
 */
import { offlineCache } from './offline-cache-service'

export class LogsService {
  constructor() {
    this.baseUrl = '/api/logs'
  }

  //============================================================================
  // УТИЛИТЫ
  //============================================================================

  /**
   * Проверяем режим полёта.
   * @returns {boolean} true — офлайн, false — онлайн.
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для HTTP-запросов к API.
   * @param {string} endpoint — путь без /api/logs/.
   * @param {Object} [options] — параметры fetch.
   * @returns {Promise<any>} тело ответа.
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    const body = options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      body
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)
    return await response.json()
  }

  //============================================================================
  // ИСТОРИЯ ОБЪЕКТОВ
  //============================================================================

  /**
   * Менеджер: добавляет запись в историю изменений объекта.
   * @param {number} objectId — ID объекта.
   * @param {string} eventType — тип события (snChanged, placeChanged и т.д.).
   * @param {string} storyLine — текстовая запись об изменении.
   * @returns {Promise<boolean>} true если запись добавлена успешно.
   */
  async addObjectHistory(objectId, eventType, storyLine) {
    if (!objectId || isNaN(objectId)) {
      console.error('[LogsService] Некорректный objectId:', objectId)
      return false
    }

    console.log(`[LogsService] Добавление записи для объекта ${objectId}:`, storyLine)

    const payload = {
      objectId: Number(objectId),
      eventType,
      storyLine
    }

    return this.isFlightMode()
      ? this.addToCache('object-history', payload)
      : this.addToApi('object-history', payload)
  }

  /**
   * Исполнитель для онлайн: отправляет лог через API.
   * @param {Object} data — данные в camelCase.
   * @returns {Promise<boolean>}
   */
  async addObjectHistoryToApi(data) {
    return this.addToApi('object-history', data)
  }

  /**
   * Исполнитель для офлайн: сохраняет лог в IndexedDB.
   * @param {Object} data — данные в camelCase.
   * @returns {Promise<boolean>}
   */
  async addObjectHistoryToCache(data) {
    return this.addToCache('object-history', data)
  }

  //============================================================================
  // ИСТОРИЯ QR-КОДОВ
  //============================================================================

  /**
   * Менеджер: добавляет запись в историю перемещений QR-кода.
   * @param {number} qrCodeValue — значение QR-кода.
   * @param {number} oldObjectId — ID старого объекта (0 для новых QR-кодов).
   * @param {number} newObjectId — ID нового объекта.
   * @returns {Promise<boolean>} true если запись добавлена успешно.
   */
  async addQrCodeHistory(qrCodeValue, objectId) {
    console.log(`[LogsService] Добавление записи для QR-кода ${qrCodeValue}: ${objectId}`)

    const payload = {
      qrCodeValue,
      objectId: Number(objectId)
    }

    return this.isFlightMode()
      ? this.addToCache('qr-code-history', payload)
      : this.addToApi('qr-code-history', payload)
  }

  /**
   * Исполнитель для онлайн: отправляет лог через API.
   * @param {Object} data — данные в camelCase.
   * @returns {Promise<boolean>}
   */
  async addQrCodeHistoryToApi(data) {
    return this.addToApi('qr-code-history', data)
  }

  /**
   * Исполнитель для офлайн: сохраняет лог в IndexedDB.
   * @param {Object} data — данные в camelCase.
   * @returns {Promise<boolean>}
   */
  async addQrCodeHistoryToCache(data) {
    return this.addToCache('qr-code-history', data)
  }

  //============================================================================
  // УНИВЕРСАЛЬНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ЛОГАМИ В API и IndexedDB
  //============================================================================

  /**
   * Универсальный метод для отправки лога в API.
   * @param {string} endpoint — эндпоинт (object-history, qr-code-history и т.д.).
   * @param {Object} data — данные в camelCase.
   * @returns {Promise<boolean>}
   */
  async addToApi(endpoint, data) {
    try {
      const result = await this.apiRequest(`/${endpoint}`, {
        method: 'POST',
        body: data
      })

      console.log(`[LogsService] Запись успешно отправлена на сервер`)
      return result.success === true
    } catch (error) {
      console.error('[LogsService] Ошибка отправки на сервер:', error)
      return false
    }
  }

  /**
   * Универсальный метод для сохранения лога в IndexedDB (офлайн режим).
   * @param {string} source — тип лога (object-history, qr-code-history и т.д.).
   * @param {Object} content — данные лога в camelCase.
   * @returns {Promise<boolean>}
   */
  async addToCache(source, content) {
    try {
      await offlineCache.addPendingLog(source, content)
      console.log(`[LogsService] Временная запись сохранена в кэш`)
      return true
    } catch (error) {
      console.error('[LogsService] Ошибка сохранения в кэш:', error)
      return false
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ИСТОРИИ
  //============================================================================

  /**
   * Менеджер: получает историю объекта.
   * @param {number} objectId — ID объекта.
   * @returns {Promise<Array>} массив записей истории в camelCase.
   */
  async getObjectHistory(objectId) {
    return this.isFlightMode()
      ? this.getObjectHistoryFromCache(objectId)
      : this.getObjectHistoryFromApi(objectId)
  }

  /**
   * Исполнитель для офлайн: получает историю из IndexedDB.
   * @param {number} objectId
   * @returns {Promise<Array>}
   */
  async getObjectHistoryFromCache(objectId) {
    const dbLogs = await offlineCache.getLogsByFilter({
      source: 'object-history',
      content: { objectId: objectId }
    })
    return dbLogs
  }

  /**
   * Исполнитель для онлайн: получает историю через API.
   * @param {number} objectId
   * @returns {Promise<Array>}
   */
  async getObjectHistoryFromApi(objectId) {
    const data = await this.apiRequest(`/object-history/${objectId}`)
    return data.history || []
  }

  /**
   * Менеджер: получает историю QR-кода.
   * @param {string} qrCodeValue — значение QR-кода.
   * @returns {Promise<Array>} массив записей истории в camelCase.
   */
  async getQrCodeHistory(qrCodeValue) {
    return this.isFlightMode()
      ? this.getQrCodeHistoryFromCache(qrCodeValue)
      : this.getQrCodeHistoryFromApi(qrCodeValue)
  }

  /**
   * Исполнитель для офлайн: получает историю из IndexedDB.
   * @param {string} qrCodeValue
   * @returns {Promise<Array>}
   */
  async getQrCodeHistoryFromCache(qrCodeValue) {
    const dbLogs = await offlineCache.getLogsByFilter({
      source: 'qr-code-history',
      content: { qrCodeValue: qrCodeValue }
    })
    return dbLogs
  }

  /**
   * Исполнитель для онлайн: получает историю через API.
   * @param {string} qrCodeValue
   * @returns {Promise<Array>}
   */
  async getQrCodeHistoryFromApi(qrCodeValue) {
    const data = await this.apiRequest(`/qr-code-history/${encodeURIComponent(qrCodeValue)}`)
    return data.history || []
  }
}

// Экспортируем синглтон
export const logsService = new LogsService()