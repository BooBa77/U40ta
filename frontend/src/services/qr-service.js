/**
 * Сервис для работы с QR-кодами
 * Поддерживает онлайн/офлайн режимы
 */
import { offlineCache } from '@/services/offline-cache-service'

export class QrService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Проверяет, активен ли режим полёта
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
      method: 'GET', // по умолчанию GET
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

  /**
   * Ищет ID объекта по QR-коду
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>} {qr_value, object_id} или null
   */
  async findObjectIdByQrCode(qrValue) {
    if (!qrValue || typeof qrValue !== 'string') {
      throw new Error('Некорректное значение QR-кода')
    }

    if (this.isFlightMode()) {
      console.log(`[QrService] Офлайн-режим: поиск объекта по QR-коду "${qrValue}"`)
      return this.findInCache(qrValue)
    }

    console.log(`[QrService] Онлайн-режим: поиск объекта по QR-коду "${qrValue}"`)
    return this.findInApi(qrValue)
  }

  /**
   * Ищет в кэше IndexedDB
   */
  async findInCache(qrValue) {
    try {
      const qrRecord = await offlineCache.db.qr_codes
        .where('qr_value')
        .equals(qrValue)
        .first()

      console.log(`[QrService] Результат поиска в кэше:`, qrRecord ? 'найден' : 'не найден')
      return qrRecord || null
    } catch (error) {
      console.error('[QrService] Ошибка поиска в кэше:', error)
      throw new Error('Не удалось найти QR-код в кэше')
    }
  }

  /**
   * Ищет через API
   */
  async findInApi(qrValue) {
    try {
      const data = await this.apiRequest(`/qr-codes/scan?qr=${encodeURIComponent(qrValue)}`)
      
      if (data.success && data.object_id) {
        return {
          qr_value: data.qr_value,
          object_id: data.object_id,
        }
      }
      
      return null
    } catch (error) {
      console.error('[QrService] Ошибка поиска через API:', error)
      throw error
    }
  }

  /**
   * Создаёт новую запись QR-кода
   * @param {string} qrValue - Значение QR-кода
   * @param {number} objectId - ID объекта
   */
  async createQrCode(qrValue, objectId) {
    if (this.isFlightMode()) {
      console.log(`[QrService] Офлайн-режим: создание QR-кода "${qrValue}" для объекта ${objectId}`)
      return this.createInCache(qrValue, objectId)
    }
    
    console.log(`[QrService] Онлайн-режим: создание QR-кода "${qrValue}" для объекта ${objectId}`)
    return this.createInApi(qrValue, objectId)
  }

  /**
   * Создаёт QR-код в кэше
   */
  async createInCache(qrValue, objectId) {
    try {
      // Проверяем, нет ли уже такого QR-кода
      const existing = await this.findInCache(qrValue)
      if (existing) {
        throw new Error(`QR-код "${qrValue}" уже существует`)
      }

      const newQrCode = {
        qr_value: qrValue,
        object_id: objectId
      }

      const id = await offlineCache.db.qr_codes.add(newQrCode)
      console.log(`[QrService] QR-код создан в кэше с ID: ${id}`)
      return { ...newQrCode, id }
    } catch (error) {
      console.error('[QrService] Ошибка создания в кэше:', error)
      throw new Error('Не удалось создать QR-код в кэше: ' + error.message)
    }
  }

  /**
   * Создаёт QR-код через API
   */
  async createInApi(objectData) {
    try {
      // Убираем id из данных
      const { id, ...dataToSend } = objectData
      
      const data = await this.apiRequest('/qr-codes', {
        method: 'POST',
        body: dataToSend
      })
      
      console.log('[ObjectService] Объект создан через API:', data)
      return data.object
    } catch (error) {
      console.error('[ObjectService] Ошибка создания через API:', error)
      throw error
    }
  }

  /**
   * Меняет владельца QR-кода
   * @param {string} qrValue - Значение QR-кода
   * @param {number} newObjectId - Новый ID объекта
   */
  async updateQrCodeOwner(qrValue, newObjectId) {
    if (this.isFlightMode()) {
      console.log(`[QrService] Офлайн-режим: обновление владельца QR-кода "${qrValue}" на объект ${newObjectId}`)
      return this.updateInCache(qrValue, newObjectId)
    }
    
    console.log(`[QrService] Онлайн-режим: обновление владельца QR-кода "${qrValue}" на объект ${newObjectId}`)
    return this.updateInApi(qrValue, newObjectId)
  }

  /**
   * Обновляет QR-код в кэше
   */
  async updateInCache(qrValue, newObjectId) {
    try {
      const qrRecord = await offlineCache.db.qr_codes
        .where('qr_value')
        .equals(qrValue)
        .first()

      if (!qrRecord) {
        throw new Error(`QR-код "${qrValue}" не найден`)
      }

      qrRecord.object_id = newObjectId
      await offlineCache.db.qr_codes.put(qrRecord)
      
      console.log(`[QrService] QR-код обновлён в кэше`)
      return true
    } catch (error) {
      console.error('[QrService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить QR-код в кэше')
    }
  }

  /**
   * Обновляет QR-код через API
   * TODO: уточнить эндпоинт у бэкенда
   */
  async updateInApi(qrValue, newObjectId) {
    try {
      const data = await this.apiRequest('/qr-codes/update-owner', {
        method: 'PUT',
        body: {
          qr_value: qrValue,
          new_object_id: Number(newObjectId)
        }
      })

      return data.success === true
    } catch (error) {
      console.error('[QrService] Ошибка обновления через API:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const qrService = new QrService()