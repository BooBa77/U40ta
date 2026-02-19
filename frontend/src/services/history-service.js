/**
 * Сервис для работы с историей изменений объектов
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from '@/services/OfflineCacheService'

export class HistoryService {
  constructor() {
    this.baseUrl = '/api/object-changes'
  }

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean} true если режим полёта включен
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Получает историю изменений объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Object[]>} Массив записей истории
   */
  async getObjectHistory(objectId) {
    console.log(`[HistoryService] Получение истории объекта ${objectId}`)
    
    if (this.isFlightMode()) {
      console.log(`[HistoryService] Офлайн-режим: получение истории из кэша`)
      return this.getFromCache(objectId)
    }
    
    console.log(`[HistoryService] Онлайн-режим: получение истории с сервера`)
    return this.getFromApi(objectId)
  }

  /**
   * Получает историю из кэша IndexedDB
   */
  async getFromCache(objectId) {
    try {
      const changes = await offlineCache.db.object_changes
        .where('object_id')
        .equals(objectId)
        .reverse()
        .sortBy('changed_at')
      
      console.log(`[HistoryService] Из кэша получено записей:`, changes.length)
      return changes
    } catch (error) {
      console.error('[HistoryService] Ошибка получения из кэша:', error)
      return []
    }
  }

  /**
   * Получает историю с сервера через API
   */
  async getFromApi(objectId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/${objectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      console.log(`[HistoryService] Получено записей с сервера:`, data.length)
      
      // Сохраняем в кэш для офлайн-использования
      await this.saveToCache(data)
      
      return data
    } catch (error) {
      console.error('[HistoryService] Ошибка получения с сервера:', error)
      return []
    }
  }

  /**
   * Добавляет запись в историю
   * @param {number} objectId - ID объекта
   * @param {string} storyLine - Текст записи
   * @returns {Promise<Object|null>} Созданная запись или null при ошибке
   */
  async addHistoryRecord(objectId, storyLine) {
    console.log(`[HistoryService] Добавление записи для объекта ${objectId}:`, storyLine)
    
    if (this.isFlightMode()) {
      // ОФЛАЙН-РЕЖИМ: создаём в IndexedDB с временным отрицательным ID
      return this.createInCache(objectId, storyLine)
    }
    
    // ОНЛАЙН-РЕЖИМ: отправляем на сервер
    return this.createInApi(objectId, storyLine)
  }

  /**
   * Создаёт запись в кэше IndexedDB
   */
  async createInCache(objectId, storyLine) {
    try {
      // Генерируем временный отрицательный ID
      const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000))
      
      const newRecord = {
        id: tempId,
        object_id: objectId,
        story_line: storyLine,
        changed_at: new Date().toISOString(),
        changed_by: null // будет заполнено при синхронизации
      }
      
      if (offlineCache.db.object_offline_changes) {
        await offlineCache.db.object_offline_changes.add(newRecord)
        console.log(`[HistoryService] Запись создана в object_offline_changes с ID ${tempId}`)
      } else {
        console.warn('[HistoryService] Таблица object_offline_changes не существует')
      }
      
      return newRecord
    } catch (error) {
      console.error('[HistoryService] Ошибка создания в кэше:', error)
      return null
    }
  }

  /**
   * Создаёт запись через API
   */
  async createInApi(objectId, storyLine) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          object_id: objectId,
          story_line: storyLine
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        console.log('[HistoryService] Запись успешно добавлена на сервер')
        // Сохраняем в кэш
        await this.saveToCache([result.data])
        return result.data
      } else {
        throw new Error(result.message || 'Неизвестная ошибка')
      }
      
    } catch (error) {
      console.error('[HistoryService] Ошибка добавления записи:', error)
      return null
    }
  }

  /**
   * Сохраняет записи в кэш IndexedDB
   */
  async saveToCache(records) {
    try {
      if (!records || !Array.isArray(records)) {
        console.warn('[HistoryService] Попытка сохранить некорректные данные в кэш')
        return
      }
      
      if (offlineCache.db.object_changes) {
        for (const record of records) {
          await offlineCache.db.object_changes.put(record)
        }
        console.log(`[HistoryService] ${records.length} записей сохранено в object_changes`)
      }
    } catch (error) {
      console.error('[HistoryService] Ошибка сохранения в кэш:', error)
    }
  }

  /**
   * Форматирует дату для отображения
   * @param {string} dateString - Дата в ISO формате
   * @returns {string} Отформатированная дата
   */
  formatDate(dateString) {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }
}

// Экспортируем синглтон
export const historyService = new HistoryService()