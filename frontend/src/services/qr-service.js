/**
 * Сервис для работы с QR-кодами
 * Поддерживает онлайн/офлайн режимы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

export class QrService {
  constructor() {
    this.baseUrl = '/api'
  }

  //============================================================================
  // БАЗОВЫЕ МЕТОДЫ
  //============================================================================

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

//============================================================================
  // ПОЛУЧЕНИЕ ОБЪЕКТА ПО QR-КОДУ
  //============================================================================

  /**
   * Ищет объект по значению QR-кода
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>} {objectId, object} или null
   */
  async findObjectByQrCode(qrValue) {
    if (!qrValue || typeof qrValue !== 'string') {
      throw new Error('Некорректное значение QR-кода')
    }

    if (this.isFlightMode()) {
      console.log(`[QrService] Офлайн-режим: поиск объекта по QR-коду "${qrValue}"`)
      return this.findObjectByQrCodeInCache(qrValue)
    }

    console.log(`[QrService] Онлайн-режим: поиск объекта по QR-коду "${qrValue}"`)
    return this.findObjectByQrCodeInApi(qrValue)
  }

  /**
   * Ищет в кэше IndexedDB
   */
  async findObjectByQrCodeInCache(qrValue) {
    try {
      const qrRecord = await offlineCache.getQrCode(qrValue)
      console.log(`[QrService] Результат поиска в кэше:`, qrRecord ? 'найден' : 'не найден')
      
      if (qrRecord) {
        const object = await offlineCache.getObject(qrRecord.objectId)
        return {
          objectId: qrRecord.objectId,
          object: object ? {
            invNumber: object.invNumber,
            buhName: object.buhName,
          } : undefined,
        }
      }
      
      return null
    } catch (error) {
      console.error('[QrService] Ошибка поиска в кэше:', error)
      throw new Error('Не удалось найти QR-код в кэше')
    }
  }

  /**
   * Ищет через API
   */
  async findObjectByQrCodeInApi(qrValue) {
    try {
      const data = await this.apiRequest(`/qr-codes/scan?qr=${encodeURIComponent(qrValue)}`)
      
      if (data.success && data.objectId) {
        return {
          objectId: data.objectId,
          object: data.object ? {
            invNumber: data.object.invNumber,
            buhName: data.object.buhName,
          } : undefined,

        }
      }
      
      return null
    } catch (error) {
      console.error('[QrService] Ошибка поиска через API:', error)
      throw error
    }
  }

  //============================================================================
  // СОЗДАНИЕ QR-КОДА
  //============================================================================

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
        qrValue: qrValue,
        objectId: objectId
      }

      const id = await offlineCache.saveQrCode(newQrCode)
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
  async createInApi(qrValue, objectId) {
    try {
      const data = await this.apiRequest('/qr-codes', {
        method: 'POST',
        body: {
          qrValue: qrValue,
          objectId: Number(objectId)
        }
      })
      
      console.log('[QrService] QR-код создан через API:', data)
      return data.success === true
    } catch (error) {
      console.error('[QrService] Ошибка создания через API:', error)
      throw error
    }
  }
  
  //============================================================================
  // ИЗМЕНЕНИЕ QR-КОДА
  //============================================================================

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
      const qrRecord = await offlineCache.getQrCode(qrValue)

      if (!qrRecord) {
        throw new Error(`QR-код "${qrValue}" не найден`)
      }

      // Обновляем владельца и сохраняем (saveQrCode сам запишет историю)
      qrRecord.objectId = newObjectId
      await offlineCache.saveQrCode(qrRecord)
      
      console.log(`[QrService] QR-код обновлён в кэше`)
      return true
    } catch (error) {
      console.error('[QrService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить QR-код в кэше')
    }
  }

  /**
   * Обновляет QR-код через API
   */
  async updateInApi(qrValue, newObjectId) {
    try {
      const data = await this.apiRequest('/qr-codes/update-owner', {
        method: 'PUT',
        body: {
          qrValue: qrValue,
          objectId: Number(newObjectId)
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