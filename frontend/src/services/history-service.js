/**
 * Сервис для работы с историей изменений объектов
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from './offline-cache-service'

export class HistoryService {
  constructor() {
    this.baseUrl = '/api/object-history'
  }

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean} true если режим полёта включен
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для запросов к API
   * @param {string} endpoint - API endpoint
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

  /**
   * Получает историю изменений объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Object[]>} Массив записей истории (от новых к старым)
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
      const history = await offlineCache.getObjectHistory(objectId)
      
      // Сортируем от новых к старым
      const sorted = history.sort((a, b) => 
        new Date(b.changed_at) - new Date(a.changed_at)
      )
      
      console.log(`[HistoryService] Из кэша получено записей:`, sorted.length)
      return sorted
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
      const data = await this.apiRequest(`/${objectId}`)
      
      console.log(`[HistoryService] Получено записей с сервера:`, data.length)
      
      // Сохраняем в кэш для офлайн-использования
      await this.saveToCache(data)
      
      // Сортируем от новых к старым
      return data.sort((a, b) => 
        new Date(b.changed_at) - new Date(a.changed_at)
      )
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
      return this.createInCache(objectId, storyLine)
    }
    
    return this.createInApi(objectId, storyLine)
  }

  /**
   * Создаёт запись в кэше IndexedDB
   */
  async createInCache(objectId, storyLine) {
    try {
      const newRecord = {
        id: null, // null = временная запись, не синхронизированная с сервером
        object_id: objectId,
        story_line: storyLine,
        changed_at: new Date().toISOString(),
        changed_by: null // будет заполнено при синхронизации
      }
      
      await offlineCache.addObjectHistory(newRecord)
      console.log(`[HistoryService] Временная запись создана в кэше`)
      
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
      const result = await this.apiRequest('', {
        method: 'POST',
        body: {
          object_id: objectId,
          story_line: storyLine
        }
      })
      
      if (result.success) {
        console.log('[HistoryService] Запись успешно добавлена на сервер')
        
        // Сохраняем в кэш (сервер вернул запись с настоящим ID)
        await this.saveToCache([result.data])
        
        return result.data
      } else {
        throw new Error(result.message || 'Неизвестная ошибка')
      }
      
    } catch (error) {
      console.error('[HistoryService] Ошибка добавления записи:', error)
      
      // Если сервер недоступен, но режим не офлайн? 
      // Возможно, стоит автоматически переключиться в офлайн-режим
      if (error.message.includes('Failed to fetch')) {
        console.log('[HistoryService] Сервер недоступен, сохраняем в кэш как временную')
        return this.createInCache(objectId, storyLine)
      }
      
      return null
    }
  }

  /**
   * Сохраняет записи в кэш IndexedDB
   * @param {Array} records - Массив записей истории с сервера
   */
  async saveToCache(records) {
    try {
      if (!records || !Array.isArray(records)) {
        console.warn('[HistoryService] Попытка сохранить некорректные данные в кэш')
        return
      }
      
      for (const record of records) {
        if (!record.id) {
          console.warn('[HistoryService] Запись без ID не будет сохранена:', record)
          continue
        }
        
        // Проверяем, есть ли уже такая запись в кэше
        const existing = await offlineCache.db.object_history
          .where('id')
          .equals(record.id)
          .first()
        
        if (existing) {
          // Обновляем существующую
          await offlineCache.db.object_history.update(record.id, record)
        } else {
          // Добавляем новую
          await offlineCache.db.object_history.add(record)
        }
      }
      
      console.log(`[HistoryService] ${records.length} записей сохранено в object_history`)
    } catch (error) {
      console.error('[HistoryService] Ошибка сохранения в кэш:', error)
    }
  }

  /**
   * Синхронизирует временные записи с сервером
   * @param {number} objectId - ID объекта (опционально, если нужна синхронизация только для одного объекта)
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncPendingRecords(objectId) {
    console.log('[HistoryService] Начинаем синхронизацию временных записей')
    
    try {
      // Получаем все временные записи (id = null)
      let query = offlineCache.db.object_history
        .where('id')
        .equals(null)
      
      if (objectId) {
        query = query.and(record => record.object_id === objectId)
      }
      
      const pendingRecords = await query.toArray()
      
      if (pendingRecords.length === 0) {
        return { success: true, synced: 0 }
      }
      
      console.log(`[HistoryService] Найдено временных записей: ${pendingRecords.length}`)
      
      const results = {
        success: true,
        synced: 0,
        failed: []
      }
      
      for (const record of pendingRecords) {
        try {
          const result = await this.apiRequest('', {
            method: 'POST',
            body: {
              object_id: record.object_id,
              story_line: record.story_line
            }
          })
          
          if (result.success) {
            // Удаляем временную запись
            await offlineCache.db.object_history
              .where('changed_at')
              .equals(record.changed_at)
              .and(r => r.id === null && r.object_id === record.object_id)
              .delete()
            
            // Сохраняем настоящую запись с ID от сервера
            await offlineCache.db.object_history.add({
              ...result.data,
              changed_at: result.data.changed_at || record.changed_at
            })
            
            results.synced++
          } else {
            results.failed.push({
              record,
              error: result.message || 'Неизвестная ошибка'
            })
          }
        } catch (error) {
          results.failed.push({
            record,
            error: error.message
          })
        }
      }
      
      console.log('[HistoryService] Синхронизация завершена:', results)
      return results
      
    } catch (error) {
      console.error('[HistoryService] Ошибка синхронизации:', error)
      return {
        success: false,
        synced: 0,
        error: error.message
      }
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