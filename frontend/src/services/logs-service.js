/**
 * Сервис для работы с универсальными логами
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 * 
 * Используется для записи любых событий: история объектов, история QR-кодов и т.д.
 */
import { offlineCache } from './offline-cache-service'

export class LogsService {
  constructor() {
    this.baseUrl = '/api/logs'
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
   * @param {string} endpoint - API endpoint (без /api/logs/)
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
  // ИСТОРИЯ ОБЪЕКТОВ
  //============================================================================

  /**
   * Добавляет запись в историю изменений объекта
   * @param {number} objectId - ID объекта
   * @param {string} storyLine - Текстовая запись об изменении
   * @returns {Promise<boolean>} true если запись добавлена успешно
   */
  async addObjectHistory(objectId, eventType, storyLine) {
    console.log(`[LogsService] Добавление записи для объекта ${objectId}:`, storyLine)
    
    if (this.isFlightMode()) {
      return this.addToCache('object_history', {
        object_id: Number(objectId),
        event_type: eventType,
        story_line: storyLine
      })
    }
    
    return this.addToApi('object-history', {
      object_id: Number(objectId),
      event_type: eventType,
      story_line: storyLine
    })
  }

  //============================================================================
  // ИСТОРИЯ QR-КОДОВ
  //============================================================================

  /**
   * Добавляет запись в историю перемещений QR-кода
   * @param {number} qrCodeId - ID записи QR-кода
   * @param {number} oldObjectId - ID старого объекта
   * @param {number} newObjectId - ID нового объекта
   * @returns {Promise<boolean>} true если запись добавлена успешно
   */
  async addQrCodeHistory(qrCodeValue, oldObjectId, newObjectId) {
    console.log(`[LogsService] Добавление записи для QR-кода ${qrCodeValue}: ${oldObjectId} -> ${newObjectId}`)
    
    if (this.isFlightMode()) {
      return this.addToCache('qr_code_history', {
        qr_code_value: qrCodeValue,
        old_object_id: Number(oldObjectId),
        new_object_id: Number(newObjectId)
      })
    }
    
    return this.addToApi('qr-code-history', {
      qr_code_value: qrCodeValue,
      old_object_id: Number(oldObjectId),
      new_object_id: Number(newObjectId)
    })
  }

  //============================================================================
  // УНИВЕРСАЛЬНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ЛОГАМИ В API и IndexedDB
  //============================================================================

  /**
   * Универсальный метод для отправки лога в API
   * @param {string} endpoint - Эндпоинт (object-history, qr-code-history и т.д.)
   * @param {Object} data - Данные для лога
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
    }
  }

  /**
   * Сохраняет лог в кэш IndexedDB (оффлайн режим)
   * @param {string} source - Тип лога (object_history, qr_code_history и т.д.)
   * @param {Object} content - Данные лога
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
}

// Экспортируем синглтон
export const logsService = new LogsService()