/**
 * Сервис для работы с объектами инвентаризации
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from '@/services/OfflineCacheService'

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
   * @param {string|number} id - ID объекта
   * @returns {Promise<Object>} Объект инвентаризации
   */
  async getObject(id) {
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
   * Создаёт новый объект
   * @param {Object} objectData - Данные объекта
   * @returns {Promise<Object>} Созданный объект с ID
   */
  async createObject(objectData) {
    console.log('[ObjectService] Создание объекта:', objectData)
    
    if (this.isFlightMode()) {
      // ОФЛАЙН-РЕЖИМ: создаём в IndexedDB с временным отрицательным ID
      return this.createInCache(objectData)
    }
    
    // ОНЛАЙН-РЕЖИМ: отправляем на сервер
    return this.createInApi(objectData)
  }

  /**
   * Создаёт объект в кэше IndexedDB
   */
  async createInCache(objectData) {
    try {
      // Генерируем временный отрицательный ID
      const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000))
      
      const newObject = {
        id: tempId,
        inv_number: objectData.inv_number || '',
        buh_name: objectData.buh_name || '',
        sklad: objectData.sklad || '',
        zavod: objectData.zavod || '',
        party_number: objectData.party_number || null,
        sn: objectData.sn || '',
        place_ter: objectData.place_ter || null,
        place_pos: objectData.place_pos || null,
        place_cab: objectData.place_cab || null,
        place_user: objectData.place_user || null,
        is_written_off: false,
        checked_at: objectData.checked_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      if (offlineCache.db.objects) {
        await offlineCache.db.objects.add(newObject)
        console.log(`[ObjectService] Объект создан в кэше с ID ${tempId}`)
      } else {
        console.warn('[ObjectService] Таблица objects не существует, объект не сохранён')
      }
      
      // Добавляем в очередь синхронизации
      await this.addToSyncQueue('create', newObject)
      
      return newObject
    } catch (error) {
      console.error('[ObjectService] Ошибка создания в кэше:', error)
      throw new Error('Не удалось создать объект в кэше')
    }
  }

  /**
   * Создаёт объект через API
   */
  async createInApi(objectData) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/objects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(objectData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      console.log('[ObjectService] Объект создан через API:', data)
      
      // Сохраняем в кэш
      await this.saveToCache(data)
      
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка создания через API:', error)
      throw error
    }
  }

  /**
   * Обновляет существующий объект
   * @param {number} id - ID объекта
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновлённый объект
   */
  async updateObject(id, updateData) {
    console.log(`[ObjectService] Обновление объекта ${id}:`, updateData)
    
    if (this.isFlightMode()) {
      return this.updateInCache(id, updateData)
    }
    
    return this.updateInApi(id, updateData)
  }

  /**
   * Обновляет объект в кэше IndexedDB
   */
  async updateInCache(id, updateData) {
    try {
      // Получаем текущий объект
      const existingObject = await offlineCache.db.objects.get(id)
      
      if (!existingObject) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      // Обновляем поля
      const updatedObject = {
        ...existingObject,
        ...updateData,
        updated_at: new Date().toISOString()
      }
      
      // Сохраняем
      await offlineCache.db.objects.put(updatedObject)
      
      // Добавляем в очередь синхронизации
      await this.addToSyncQueue('update', { id, ...updateData })
      
      console.log(`[ObjectService] Объект ${id} обновлён в кэше`)
      return updatedObject
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить объект в кэше')
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
   * Универсальный метод сохранения объекта
   * Создаёт новый или обновляет существующий
   * @param {Object} objectData - Данные объекта (может содержать id)
   * @returns {Promise<Object>} Сохранённый объект
   */
  async saveObject(objectData) {
    const hasId = objectData.id && objectData.id !== null
    
    if (hasId) {
      // Обновление существующего
      const { id, ...updateData } = objectData
      return this.updateObject(id, updateData)
    } else {
      // Создание нового
      return this.createObject(objectData)
    }
  }

  /**
   * Добавляет операцию в очередь синхронизации
   */
  async addToSyncQueue(action, data) {
    try {
      if (!offlineCache.db.sync_queue) {
        console.warn('[ObjectService] Таблица sync_queue не существует')
        return
      }
      
      const syncRecord = {
        table: 'objects',
        action: action,
        data: data,
        created_at: new Date().toISOString(),
        synced: false
      }
      
      await offlineCache.db.sync_queue.add(syncRecord)
      console.log(`[ObjectService] Операция добавлена в очередь синхронизации`)
    } catch (error) {
      console.error('[ObjectService] Ошибка добавления в очередь синхронизации:', error)
    }
  }

  /**
   * Сохраняет объект в кэш IndexedDB
   */
  async saveToCache(objectData) {
    try {
      if (!objectData || !objectData.id) {
        console.warn('[ObjectService] Попытка сохранить некорректные данные в кэш')
        return
      }
      
      if (offlineCache.db.objects) {
        await offlineCache.db.objects.put(objectData)
        console.log(`[ObjectService] Объект ID ${objectData.id} сохранён в кэш`)
      }
    } catch (error) {
      console.error('[ObjectService] Ошибка сохранения в кэш:', error)
    }
  }

  /**
   * Проверяет доступность объекта в кэше
   */
  async hasCachedObject(id) {
    try {
      const object = await offlineCache.db.objects.get(id)
      return !!object
    } catch {
      return false
    }
  }
}

// Экспортируем синглтон
export const objectService = new ObjectService()