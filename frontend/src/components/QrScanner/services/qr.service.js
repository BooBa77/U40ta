/**
 * Сервис для работы с QR-кодами
 * Поддерживает онлайн/офлайн режимы
 */
import { offlineCache } from '../../../services/OfflineCacheService'

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
   * Проверяет, существует ли QR-код в базе
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>} Запись qr_codes или null если не найдено
   */
  async checkQrCode(qrValue) {
    if (!qrValue || typeof qrValue !== 'string') {
      throw new Error('Некорректное значение QR-кода')
    }

    if (this.isFlightMode()) {
      console.log(`[QrService] Офлайн-режим: проверка QR-кода "${qrValue}"`)
      return this.checkInCache(qrValue)
    }

    console.log(`[QrService] Онлайн-режим: проверка QR-кода "${qrValue}"`)
    return this.checkInApi(qrValue)
  }

  /**
   * Проверяет QR-код в кэше IndexedDB
   */
  async checkInCache(qrValue) {
    try {
      // Ищем в таблице qr_codes
      const qrRecord = await offlineCache.db.qr_codes
        .where('qr_value')
        .equals(qrValue)
        .first()

      console.log(`[QrService] Результат проверки в кэше:`, qrRecord ? 'найден' : 'не найден')
      return qrRecord || null
    } catch (error) {
      console.error('[QrService] Ошибка проверки в кэше:', error)
      throw new Error('Не удалось проверить QR-код в кэше')
    }
  }

  /**
   * Проверяет QR-код через API
   */
  async checkInApi(qrValue) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/qr-codes/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ qrValue })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.exists) {
        return data.qrRecord // { qr_value, object_id, ... }
      }
      
      return null // Код не найден
    } catch (error) {
      console.error('[QrService] Ошибка проверки через API:', error)
      throw error
    }
  }

  /**
   * Проверяет QR-код и возвращает его с данными объекта
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>} { qrRecord, objectData } или null
   */
  async getQrCodeWithObject(qrValue) {
    try {
      // 1. Получаем запись QR-кода
      const qrRecord = await this.checkQrCode(qrValue)
      
      if (!qrRecord) {
        return null
      }
      
      // 2. Получаем данные объекта
      let objectData = null
      
      if (this.isFlightMode()) {
        // Офлайн: из IndexedDB таблицы objects
        objectData = await offlineCache.db.objects
          .where('id')
          .equals(qrRecord.object_id)
          .first()
        
        console.log(`[QrService] Данные объекта из кэша:`, objectData)
      } else {
        // Онлайн: через API
        try {
          const token = localStorage.getItem('auth_token')
          const response = await fetch(`${this.baseUrl}/objects/${qrRecord.object_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.object) {
              objectData = data.object
            }
          }
        } catch (apiError) {
          console.warn('[QrService] Не удалось получить данные объекта через API:', apiError)
          // Если API не отвечает, возвращаем минимум данных
          objectData = { id: qrRecord.object_id }
        }
      }
      
      return {
        qrRecord,
        objectData: objectData || { id: qrRecord.object_id }
      }
    } catch (error) {
      console.error('[QrService] Ошибка получения QR с объектом:', error)
      throw error
    }
  }

  /**
   * Создаёт новый QR-код в базе
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
      const existing = await this.checkInCache(qrValue)
      if (existing) {
        throw new Error(`QR-код "${qrValue}" уже существует`)
      }

      const newQrCode = {
        qr_value: qrValue,
        object_id: objectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
  async createInApi(qrValue, objectId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/qr-codes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          qrValue,
          objectId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      return data.success === true
    } catch (error) {
      console.error('[QrService] Ошибка создания через API:', error)
      throw error
    }
  }

  /**
   * Обновляет владельца QR-кода
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
      // Находим запись
      const qrRecord = await offlineCache.db.qr_codes
        .where('qr_value')
        .equals(qrValue)
        .first()

      if (!qrRecord) {
        throw new Error(`QR-код "${qrValue}" не найден`)
      }

      // Обновляем
      qrRecord.object_id = newObjectId
      qrRecord.updated_at = new Date().toISOString()

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
   */
  async updateInApi(qrValue, newObjectId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/qr-codes/update-owner`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          qrValue,
          newObjectId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      return data.success === true
    } catch (error) {
      console.error('[QrService] Ошибка обновления через API:', error)
      throw error
    }
  }

  /**
   * Получает объект по ID
   */
  async getObjectById(objectId) {
    try {
      if (this.isFlightMode()) {
        // Из кэша
        return await offlineCache.db.objects
          .where('id')
          .equals(objectId)
          .first()
      } else {
        // Из API
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${this.baseUrl}/objects/${objectId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          return data.object || null
        }
        return null
      }
    } catch (error) {
      console.error('[QrService] Ошибка получения объекта:', error)
      return null
    }
  }
}

// Экспортируем синглтон
export const qrService = new QrService()