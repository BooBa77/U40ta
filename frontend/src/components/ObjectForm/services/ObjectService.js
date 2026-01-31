/**
 * Сервис для работы с объектами инвентаризации
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from '../../../services/OfflineCacheService'

export class ObjectService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean} true если режим полёта включен
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Получает объект по ID
   * В онлайн-режиме: запрос к API
   * В офлайн-режиме: получение из кэша IndexedDB
   * @param {string|number} id - ID объекта
   * @returns {Promise<Object>} Объект инвентаризации
   * @throws {Error} Ошибка загрузки данных
   */
  async fetchObject(id) {
    const objectId = Number(id)
    
    if (this.isFlightMode()) {
      console.log(`[ObjectService] Офлайн-режим: получение объекта ${objectId} из кэша`)
      return this.getFromCache(objectId)
    }
    
    console.log(`[ObjectService] Онлайн-режим: получение объекта ${objectId} с сервера`)
    return this.getFromApi(objectId)
  }

  /**
   * Получает объект из кэша IndexedDB
   * @param {number} id - ID объекта
   * @returns {Promise<Object>} Данные объекта
   */
  async getFromCache(id) {
    try {
      const object = await offlineCache.db.objects.get(id)
      
      if (!object) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      console.log(`[ObjectService] Из кэша получен объект:`, object)
      return object
    } catch (error) {
      console.error('[ObjectService] Ошибка получения из кэша:', error)
      throw new Error('Не удалось загрузить объект из кэша')
    }
  }

  /**
   * Получает объект с сервера через API
   * @param {number} id - ID объекта
   * @returns {Promise<Object>} Данные объекта
   */
  async getFromApi(id) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/objects/${id}`, {
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
      
      // Сохраняем в кэш для офлайн-использования
      await this.saveToCache(data)
      
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка получения с сервера:', error)
      throw error
    }
  }

  /**
   * Сохраняет объект в кэш IndexedDB
   * @param {Object} objectData - Данные объекта
   */
  async saveToCache(objectData) {
    try {
      if (!objectData || !objectData.id) {
        console.warn('[ObjectService] Попытка сохранить некорректные данные в кэш:', objectData)
        return
      }
      
      // Проверяем, существует ли уже таблица объектов
      if (!offlineCache.db.objects) {
        console.warn('[ObjectService] Таблица objects не существует в IndexedDB')
        return
      }
      
      await offlineCache.db.objects.put(objectData)
      console.log(`[ObjectService] Объект ID ${objectData.id} сохранён в кэш`)
    } catch (error) {
      console.error('[ObjectService] Ошибка сохранения в кэш:', error)
    }
  }

  /**
   * Обновляет объект
   * В онлайн-режиме: отправка на сервер + обновление кэша
   * В офлайн-режиме: только обновление кэша
   * @param {number} id - ID объекта
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновлённый объект
   */
  async updateObject(id, updateData) {
    const objectId = Number(id)
    
    if (this.isFlightMode()) {
      console.log(`[ObjectService] Офлайн-режим: обновление объекта ${objectId} в кэше`)
      return this.updateInCache(objectId, updateData)
    }
    
    console.log(`[ObjectService] Онлайн-режим: обновление объекта ${objectId} на сервере`)
    return this.updateInApi(objectId, updateData)
  }

  /**
   * Обновляет объект в кэше IndexedDB
   */
  async updateInCache(id, updateData) {
    try {
      // Получаем текущий объект из кэша
      const existingObject = await offlineCache.db.objects.get(id)
      
      if (!existingObject) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      // Обновляем только разрешённые поля
      const updatedObject = {
        ...existingObject,
        ...updateData,
        // Обновляем дату проверки, если не передана
        checked_at: updateData.checked_at || existingObject.checked_at || new Date().toISOString().split('T')[0]
      }
      
      // Сохраняем обновлённый объект
      await offlineCache.db.objects.put(updatedObject)
      
      console.log(`[ObjectService] Объект ID ${id} обновлён в кэше:`, updatedObject)
      
      // Добавляем в очередь синхронизации
      await this.addToSyncQueue(id, updateData)
      
      return updatedObject
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить объект в кэше')
    }
  }

  /**
   * Добавляет изменение в очередь синхронизации
   */
  async addToSyncQueue(id, updateData) {
    try {
      if (!offlineCache.db.sync_queue) {
        console.warn('[ObjectService] Таблица sync_queue не существует')
        return
      }
      
      const syncRecord = {
        table: 'objects',
        record_id: id,
        action: 'update',
        data: updateData,
        created_at: new Date().toISOString(),
        synced: false
      }
      
      await offlineCache.db.sync_queue.add(syncRecord)
      console.log(`[ObjectService] Изменение объекта ${id} добавлено в очередь синхронизации`)
    } catch (error) {
      console.error('[ObjectService] Ошибка добавления в очередь синхронизации:', error)
    }
  }

  /**
   * Обновляет объект через API
   */
  async updateInApi(id, updateData) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/objects/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      
      // Обновляем кэш
      await this.saveToCache(data)
      
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления через API:', error)
      throw error
    }
  }

  /**
   * Проверяет доступность объекта в кэше
   * @param {number} id - ID объекта
   * @returns {Promise<boolean>} true если объект есть в кэше
   */
  async hasCachedObject(id) {
    try {
      const object = await offlineCache.db.objects.get(id)
      return !!object
    } catch {
      return false
    }
  }

  /**
   * Создаёт новый объект инвентаризации
   * @param {Object} objectData - Данные объекта
   * @returns {Promise<Object>} Созданный объект с ID
   */  
  async createObject(objectData) {
    if (this.isFlightMode()) {
      // Офлайн логика
    }
    
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${this.baseUrl}/objects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(objectData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[ObjectService] Полный ответ от сервера:', data);
    return data.object; // { id, ... }
  }  


}

// Экспортируем синглтон для использования во всем приложении
export const objectService = new ObjectService()