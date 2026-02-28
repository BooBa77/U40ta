/**
 * Сервис для работы с объектами инвентаризации
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from '@/services/offline-cache-service'

export class ObjectService {
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
  // ПОЛУЧЕНИЕ ОБЪЕКТА ПО ID
  //============================================================================

  /**
   * Менеджер: получает объект по ID
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
   * Исполнитель для офлайн: получает объект из IndexedDB
   */
  async getFromCache(id) {
    try {
      const object = await offlineCache.db.objects.get(id)
      
      if (!object) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      return object
    } catch (error) {
      console.error('[ObjectService] Ошибка получения из кэша:', error)
      throw new Error('Не удалось загрузить объект из кэша')
    }
  }

  /**
   * Исполнитель для онлайн: получает объект через API
   */
  async getFromApi(id) {
    try {
      const data = await this.apiRequest(`/objects/${id}`)
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка получения с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // УНИВЕРСАЛЬНОЕ СОХРАНЕНИЕ
  //============================================================================

  /**
   * Управляющий метод: создаёт или обновляет объект в зависимости от наличия ID
   * @param {Object} objectData - Данные объекта (может содержать id)
   * @returns {Promise<Object>} Сохранённый объект
   */
  async saveObject(objectData) {
    const hasId = objectData.id && objectData.id !== null
    
    if (hasId) {
      const { id, ...updateData } = objectData
      return this.updateObject(id, updateData)
    } else {
      return this.createObject(objectData)
    }
  }
  
  //============================================================================
  // СОЗДАНИЕ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: создаёт новый объект
   * @param {Object} objectData - Данные объекта
   * @returns {Promise<Object>} Созданный объект с ID
   */
  async createObject(objectData) {
    console.log('[ObjectService] Создание объекта:', objectData)
    
    if (this.isFlightMode()) {
      return this.createInCache(objectData)
    }
    
    return this.createInApi(objectData)
  }

  /**
   * Исполнитель для офлайн: создаёт объект в IndexedDB
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
      
      await offlineCache.db.objects.add(newObject)
      console.log(`[ObjectService] Объект создан в кэше с ID ${tempId}`)
      
      return newObject
    } catch (error) {
      console.error('[ObjectService] Ошибка создания в кэше:', error)
      throw new Error('Не удалось создать объект в кэше')
    }
  }

  /**
   * Исполнитель для онлайн: создаёт объект через API
   */
  async createInApi(objectData) {
    try {
      const { id, ...dataToSend } = objectData
      
      const data = await this.apiRequest('/objects', {
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

  //============================================================================
  // ОБНОВЛЕНИЕ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: обновляет существующий объект
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
   * Исполнитель для офлайн: обновляет объект в IndexedDB
   */
  async updateInCache(id, updateData) {
    try {
      const existingObject = await offlineCache.db.objects.get(id)
      
      if (!existingObject) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      const updatedObject = {
        ...existingObject,
        ...updateData,
        updated_at: new Date().toISOString()
      }
      
      await offlineCache.db.objects.put(updatedObject)
      console.log(`[ObjectService] Объект ${id} обновлён в кэше`)
      
      return updatedObject
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить объект в кэше')
    }
  }

  /**
   * Исполнитель для онлайн: обновляет объект через API
   */
  async updateInApi(id, updateData) {
    try {
      const data = await this.apiRequest(`/objects/${id}`, {
        method: 'PATCH',
        body: updateData
      })
      
      console.log(`[ObjectService] Объект ${id} обновлён через API`)
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления через API:', error)
      throw error
    }
  }

  //============================================================================
  // ПОИСК ОБЪЕКТОВ ПО ИНВЕНТАРНОМУ НОМЕРУ
  //============================================================================

  /**
   * Менеджер: получает объекты по инвентарному номеру
   * @param {string} inv - Инвентарный номер
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>} Массив объектов
   */
  async getObjectsByInv(inv, zavod, sklad) {
    const params = new URLSearchParams()
    params.append('inv', inv)
    
    if (zavod !== undefined && zavod !== null) {
      params.append('zavod', zavod)
    }
    
    if (sklad !== undefined && sklad !== null) {
      params.append('sklad', sklad)
    }
    
    if (this.isFlightMode()) {
      console.log(`[ObjectService] Офлайн-режим: поиск по inv=${inv}, zavod=${zavod}, sklad=${sklad}`)
      return this.getByInvFromCache(inv, zavod, sklad)
    }
    
    console.log(`[ObjectService] Онлайн-режим: поиск по inv=${inv}, zavod=${zavod}, sklad=${sklad}`)
    return this.getByInvFromApi(params)
  }

  /**
   * Исполнитель для офлайн: ищет объекты в IndexedDB по инвентарному номеру
   */
  async getByInvFromCache(inv, zavod, sklad) {
    try {
      const allObjects = await offlineCache.db.objects.toArray()
      
      const filtered = allObjects.filter(obj => {
        if (obj.inv_number !== inv) return false
        if (zavod !== undefined && obj.zavod !== zavod) return false
        if (sklad !== undefined && obj.sklad !== sklad) return false
        return true
      })
      
      console.log(`[ObjectService] Из кэша найдено объектов: ${filtered.length}`)
      return filtered
    } catch (error) {
      console.error('[ObjectService] Ошибка поиска в кэше:', error)
      return []
    }
  }

  /**
   * Исполнитель для онлайн: ищет объекты через API по инвентарному номеру
   */
  async getByInvFromApi(params) {
    try {
      const data = await this.apiRequest(`/objects/by-inv?${params.toString()}`)
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка поиска объектов')
      }
      
      return data.objects || []
    } catch (error) {
      console.error('[ObjectService] Ошибка поиска через API:', error)
      throw error
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ МЕСТОПОЛОЖЕНИЙ
  //============================================================================

  /**
   * Менеджер: получает все уникальные комбинации местоположений
   * @returns {Promise<Array<{ter: string, pos: string|null, cab: string|null, user: string|null}>>}
   */
  async getPlaceCombinations() {
    if (this.isFlightMode()) {
      console.log('[ObjectService] Офлайн-режим: получение местоположений из кэша')
      return this.getPlacesFromCache()
    }
    
    console.log('[ObjectService] Онлайн-режим: получение местоположений с сервера')
    return this.getPlacesFromApi()
  }

  /**
   * Исполнитель для офлайн: получает уникальные комбинации местоположений из IndexedDB
   */
  async getPlacesFromCache() {
    try {
      const allObjects = await offlineCache.db.objects.toArray()
      
      const combinationsMap = new Map()
      
      allObjects.forEach(obj => {
        if (!obj.place_ter || obj.place_ter.trim() === '') return
        
        const key = `${obj.place_ter}|${obj.place_pos || ''}|${obj.place_cab || ''}|${obj.place_user || ''}`
        
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, {
            ter: obj.place_ter,
            pos: obj.place_pos || null,
            cab: obj.place_cab || null,
            user: obj.place_user || null
          })
        }
      })
      
      const combinations = Array.from(combinationsMap.values())
      console.log(`[ObjectService] Из кэша построено комбинаций: ${combinations.length}`)
      return combinations
      
    } catch (error) {
      console.error('[ObjectService] Ошибка построения комбинаций из кэша:', error)
      return []
    }
  }

  /**
   * Исполнитель для онлайн: получает комбинации местоположений через API
   */
  async getPlacesFromApi() {
    try {
      const data = await this.apiRequest('/objects/place-combinations')
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка загрузки комбинаций местоположений')
      }
      
      return data.combinations || []
    } catch (error) {
      console.error('[ObjectService] Ошибка получения местоположений с сервера:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const objectService = new ObjectService()