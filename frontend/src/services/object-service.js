/**
 * Сервис для работы с объектами инвентаризации
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

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
      const dbObject = await offlineCache.getObject(id)
      
      if (!dbObject) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      // Маппим snake_case → camelCase для JS
      return {
        ...dbObject,
        invNumber: dbObject.inv_number,
        buhName: dbObject.buh_name,
        partyNumber: dbObject.party_number,
        placeTer: dbObject.place_ter,
        placePos: dbObject.place_pos,
        placeCab: dbObject.place_cab,
        placeUser: dbObject.place_user,
        isWrittenOff: dbObject.is_written_off,
        checkedAt: dbObject.checked_at,
        createdAt: dbObject.created_at,
        updatedAt: dbObject.updated_at
      }
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
  // УНИВЕРСАЛЬНОЕ СОХРАНЕНИЕ (С РАСШИРЕННЫМ DTO)
  //============================================================================

  /**
   * Управляющий метод: создаёт или обновляет объект с фото и QR-кодами
   * @param {Object} payload - Расширенный DTO
   * @param {Object} payload.objectData - Данные объекта (может содержать id)
   * @param {Array<string>} [payload.qrCodes] - Массив значений QR-кодов
   * @param {Array<{max: string, min: string}>} [payload.photosToAdd] - Новые фото в base64
   * @param {Array<number>} [payload.photosToDelete] - ID фото для удаления
   * @returns {Promise<Object>} Сохранённый объект
   */
  async saveObject(payload) {
    console.log('DEBUG saveObject: payload', payload)
    const { objectData, qrCodes = [], photosToAdd = [], photosToDelete = [] } = payload
    const hasId = objectData.id && objectData.id !== null
    console.log('DEBUG saveObject: hasId', hasId)
    
    if (hasId) {
      const { id, invNumber, buhName, sklad, zavod, partyNumber, ...updateData } = objectData
      console.log('DEBUG saveObject: updateData', updateData)
      return this.updateObject(id, {
        ...updateData,
        qrCodes,
        photosToAdd,
        photosToDelete
      })
    } else {
      const { id, ...createData } = objectData
      return this.createObject({
        ...createData,
        qrCodes,
        photosToAdd,
        photosToDelete
      })
    }
  }
  
  //============================================================================
  // СОЗДАНИЕ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: создаёт новый объект с фото и QR-кодами
   * @param {Object} objectData - Данные объекта
   * @param {Array<string>} [objectData.qrCodes] - QR-коды
   * @param {Array<{max: string, min: string}>} [objectData.photosToAdd] - Новые фото
   * @param {Array<number>} [objectData.photosToDelete] - Фото для удаления (для новых объектов всегда пусто)
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
    const { qrCodes = [], photosToAdd = [], ...restData } = objectData
    
    try {
      // Генерируем временный отрицательный ID
      const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000))
      
      const newObject = {
        id: tempId,
        inv_number: restData.invNumber || '',
        buh_name: restData.buhName || '',
        sklad: restData.sklad || '',
        zavod: restData.zavod || '',
        party_number: restData.partyNumber || null,
        sn: restData.sn || '',
        place_ter: restData.ter || restData.placeTer || null,
        place_pos: restData.pos || restData.placePos || null,
        place_cab: restData.cab || restData.placeCab || null,
        place_user: restData.user || restData.placeUser || null,
        place: restData.place || null,
        is_written_off: false,
        checked_at: restData.checkedAt || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // Транзакционное сохранение
      let savedId = tempId
      
      await offlineCache.db.transaction('rw', 
        [offlineCache.db.objects, offlineCache.db.qr_codes, offlineCache.db.photos], 
        async () => {
          // 1. Сохраняем объект
          savedId = await offlineCache.addObject(newObject)
          
          // 2. Сохраняем QR-коды
          for (const qrValue of qrCodes) {
            await offlineCache.saveQrCode({
              qrValue: qrValue,
              objectId: savedId
            })
          }
          
          // 3. Сохраняем фото (photosToAdd содержат base64, нужно преобразовать в Blob и ArrayBuffer)
          for (const photoData of photosToAdd) {
            const maxBlob = await this.base64ToBlob(photoData.max)
            const minBlob = await this.base64ToBlob(photoData.min)
            
            await offlineCache.savePhoto({
              objectId: savedId,
              photoMaxData: await this.blobToArrayBuffer(maxBlob),
              photoMinData: await this.blobToArrayBuffer(minBlob)
            })
          }
        }
      )
      
      console.log(`[ObjectService] Объект создан в кэше с ID ${savedId}`)
      return { ...newObject, id: savedId }
      
    } catch (error) {
      console.error('[ObjectService] Ошибка создания в кэше:', error)
      throw new Error('Не удалось создать объект в кэше')
    }
  }

  /**
   * Исполнитель для онлайн: создаёт объект через API
   */
  async createInApi(objectData) {
    console.log('[ObjectService] createInApi: полный объект для отправки:', JSON.stringify(objectData, null, 2))
    
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
   * @param {Object} updateData - Данные для обновления (могут содержать qrCodes, photosToAdd, photosToDelete)
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
   * Исполнитель для офлайн: обновляет объект в IndexedDB (PATCH-семантика)
   */
  async updateInCache(id, updateData) {
    const { qrCodes = [], photosToAdd = [], photosToDelete = [], ...objectUpdates } = updateData
    
    try {
      let updatedObject = null
      
      await offlineCache.db.transaction('rw', 
        [offlineCache.db.objects, offlineCache.db.qr_codes, offlineCache.db.photos], 
        async () => {
          // 1. Получаем существующий объект
          const existingObject = await offlineCache.getObject(id)
          
          if (!existingObject) {
            throw new Error(`Объект с ID ${id} не найден в кэше`)
          }
          
          // 2. Обновляем только переданные поля (PATCH-семантика)
          const patchedObject = {
            ...existingObject,
            ...objectUpdates,
            place_ter: objectUpdates.placeTer ?? existingObject.place_ter,
            place_pos: objectUpdates.placePos ?? existingObject.place_pos,
            place_cab: objectUpdates.placeCab ?? existingObject.place_cab,
            place_user: objectUpdates.placeUser ?? existingObject.place_user,
            updated_at: new Date().toISOString()
          }
          
          // Удаляем временные поля, если они есть
          delete patchedObject.placeTer
          delete patchedObject.placePos
          delete patchedObject.placeCab
          delete patchedObject.placeUser
          
          updatedObject = await offlineCache.updateObject(id, patchedObject)
          
          // 3. Обрабатываем QR-коды (каждый qrCode сохраняем/обновляем)
          for (const qrValue of qrCodes) {
            await offlineCache.saveQrCode({
              qrValue: qrValue,
              objectId: id
            })
          }
          
          // 4. Удаляем фото
          for (const photoId of photosToDelete) {
            await offlineCache.deletePhoto(photoId)
          }
          
          // 5. Добавляем новые фото
          for (const photoData of photosToAdd) {
            const maxBlob = await this.base64ToBlob(photoData.max)
            const minBlob = await this.base64ToBlob(photoData.min)
            
            await offlineCache.savePhoto({
              objectId: id,
              photoMaxData: await this.blobToArrayBuffer(maxBlob),
              photoMinData: await this.blobToArrayBuffer(minBlob)
            })
          }
        }
      )
      
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
    console.log('DEBUG updateInApi: отправляем на сервер', JSON.stringify(updateData, null, 2))
    try {
      const data = await this.apiRequest(`/objects/${id}`, {
        method: 'PATCH',
        body: updateData
      })
      
      console.log('DEBUG updateInApi response data:', data)
      console.log(`[ObjectService] Объект ${id} обновлён через API`)
      return data
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления через API:', error)
      throw error
    }
  }

  //============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С BLOB/BASE64
  //============================================================================

  /**
   * Конвертирует base64 строку в Blob
   * @param {string} base64 - base64 строка (без префикса data:image/jpeg;base64,)
   * @returns {Promise<Blob>}
   */
  async base64ToBlob(base64) {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: 'image/jpeg' })
  }

  /**
   * Конвертирует Blob в ArrayBuffer
   * @param {Blob} blob
   * @returns {Promise<ArrayBuffer>}
   */
  async blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob)
    })
  }

  //============================================================================
  // ОСТАЛЬНЫЕ МЕТОДЫ (БЕЗ ИЗМЕНЕНИЙ)
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

  async getByInvFromCache(inv, zavod, sklad) {
    try {
      const dbObjects = await offlineCache.findObjectsByInv(inv, zavod, sklad)
      console.log(`[ObjectService] Из кэша найдено объектов: ${dbObjects.length}`)
      
      // Маппим в camelCase для JS
      return dbObjects.map(obj => ({
        ...obj,
        invNumber: obj.inv_number,
        buhName: obj.buh_name,
        partyNumber: obj.party_number,
        placeTer: obj.place_ter,
        placePos: obj.place_pos,
        placeCab: obj.place_cab,
        placeUser: obj.place_user,
        isWrittenOff: obj.is_written_off,
        checkedAt: obj.checked_at,
        createdAt: obj.created_at,
        updatedAt: obj.updated_at
      }))
    }
  }  

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

  async getPlaceCombinations() {
    if (this.isFlightMode()) {
      console.log('[ObjectService] Офлайн-режим: получение местоположений из кэша')
      return this.getPlacesFromCache()
    }
    
    console.log('[ObjectService] Онлайн-режим: получение местоположений с сервера')
    return this.getPlacesFromApi()
  }

  async getPlacesFromCache() {
    try {
      const objects = await offlineCache.getAllObjects()
      
      const combinationsMap = new Map()
      
      objects.forEach(obj => {
        if (!obj.ter || obj.ter.trim() === '') return
        
        const key = `${obj.ter}|${obj.pos || ''}|${obj.cab || ''}|${obj.user || ''}`
        
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, {
            ter: obj.ter,
            pos: obj.pos || null,
            cab: obj.cab || null,
            user: obj.user || null
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

  async updateCheckedAt(id) {
    const objectId = Number(id)
    const checkedAt = new Date().toISOString()
    
    console.log(`[ObjectService] Обновление checkedAt для объекта ${objectId}`)
    
    if (this.isFlightMode()) {
      return this.updateCheckedAtInCache(objectId, checkedAt)
    }
    
    return this.updateCheckedAtInApi(objectId, checkedAt)
  }

  async updateCheckedAtInCache(id, checkedAt) {
    try {
      const existingObject = await offlineCache.getObject(id)
      
      if (!existingObject) {
        throw new Error(`Объект с ID ${id} не найден в кэше`)
      }
      
      const updatedObject = await offlineCache.updateObject(id, {
        checked_at: checkedAt,
        updated_at: checkedAt
      })
      
      console.log(`[ObjectService] checked_at объекта ${id} обновлён в кэше`)
      return updatedObject
      
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления checked_at в кэше:', error)
      throw new Error('Не удалось обновить дату проверки в кэше')
    }
  }

  async updateCheckedAtInApi(id, checkedAt) {
    try {
      const data = await this.apiRequest(`/objects/${id}`, {
        method: 'PATCH',
        body: { checkedAt: checkedAt }
      })
      
      console.log(`[ObjectService] checkedAt объекта ${id} обновлён через API`)
      return data
      
    } catch (error) {
      console.error('[ObjectService] Ошибка обновления checkedAt через API:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const objectService = new ObjectService()