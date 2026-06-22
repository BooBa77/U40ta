/**
 * Сервис для работы с объектами инвентаризации.
 * Поддерживает онлайн/офлайн режимы.
 *
 * Онлайн (flightMode = false): все запросы к API.
 * Офлайн (flightMode = true): все операции в IndexedDB.
 *
 * Соглашение об именовании:
 * - Фронтовый код и API общаются в camelCase.
 * - IndexedDB хранит данные в camelCase.
 */
import { offlineCache } from './offline-cache-service'

export class ObjectService {
  constructor() {
    this.baseUrl = '/api'
  }

  //============================================================================
  // УТИЛИТЫ
  //============================================================================

  /**
   * Проверяем режим полёта.
   * @returns {boolean} true — офлайн, false — онлайн.
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для HTTP-запросов к API.
   * @param {string} endpoint — путь без /api/.
   * @param {Object} [options] — параметры fetch.
   * @returns {Promise<any>} тело ответа.
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`

    const body = options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      body
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)
    return await response.json()
  }

  /**
   * Проверяет, имеет ли текущий пользователь доступ к складу как МОЛ.
   * В офлайн-режиме всегда возвращает true (сохраняем в кэш, а разбитаться при синхронизации).
   * 
   * @param {number} zavod — номер завода.
   * @param {string} sklad — код склада.
   * @returns {Promise<boolean>} true если МОЛ или офлайн, false если гость в онлайне.
   */
  async checkSkladAccess(zavod, sklad) {
    if (this.isFlightMode()) return true

    try {
      const data = await this.apiRequest(
        `/users/me/has-access-to-sklad/${zavod}/${encodeURIComponent(sklad)}`
      )
      return data.canEdit === true
    } catch {
      return false
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ОБЪЕКТА ПО ID
  //============================================================================

  /**
   * Менеджер: получает объект по ID.
   * @param {string|number} id — ID объекта.
   * @returns {Promise<Object>} объект инвентаризации (camelCase).
   */
  async getObject(id) {
    const objectId = Number(id)
    return this.isFlightMode()
      ? this.getObjectFromCache(objectId)
      : this.getObjectFromApi(objectId)
  }

  /**
   * Исполнитель для офлайн: получает объект из IndexedDB.
   * @param {number} id — ID объекта.
   * @returns {Promise<Object>} объект в camelCase.
   */
  async getObjectFromCache(id) {
    const dbObject = await offlineCache.getObject(id)
    if (!dbObject) throw new Error(`Объект с ID ${id} не найден в кэше`)
    return dbObject
  }

  /**
   * Исполнитель для онлайн: получает объект через API.
   * @param {number} id — ID объекта.
   * @returns {Promise<Object>} ответ API.
   */
  async getObjectFromApi(id) {
    return this.apiRequest(`/objects/${id}`)
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ОБЪЕКТОВ
  //============================================================================

  /**
   * Менеджер: получает объекты по инвентарному номеру и партии.
   * @param {string} inv — инвентарный номер.
   * @param {string} [partyNumber] — партия объекта.
   * @param {number} [zavod] — номер завода.
   * @param {string} [sklad] — код склада.
   * @returns {Promise<Array>} массив объектов (camelCase).
   */
  async getObjectsByInv(inv, partyNumber, zavod, sklad) {
    const params = new URLSearchParams({ inv })
    if (partyNumber != null) params.append('party', partyNumber)
    if (zavod != null) params.append('zavod', zavod)
    if (sklad != null) params.append('sklad', sklad)

    return this.isFlightMode()
      ? this.getByInvFromCache(inv, partyNumber, zavod, sklad)
      : this.getByInvFromApi(params)
  }

  /**
   * Исполнитель для офлайн: поиск объектов в IndexedDB.
   * @param {string} inv — инвентарный номер.
   * @param {string} [partyNumber] — партия объекта.
   * @param {number} [zavod] — номер завода.
   * @param {string} [sklad] — код склада.
   * @returns {Promise<Array>} массив объектов в camelCase.
   */
  async getByInvFromCache(inv, partyNumber, zavod, sklad) {
    const dbObjects = await offlineCache.findObjectsByInv(inv, partyNumber, zavod, sklad)
    return dbObjects
  }

  /**
   * Исполнитель для онлайн: поиск объектов через API.
   * @param {URLSearchParams} params
   * @returns {Promise<Array>} массив объектов.
   */
  async getByInvFromApi(params) {
    const data = await this.apiRequest(`/objects/by-inv?${params}`)
    return data.objects || []
  }

  /**
   * Ищет похожие объекты на сервере для проверки дубликатов перед синхронизацией.
   * Используется при выходе из офлайна для новых объектов (id < 0).
   *
   * Для docType='ОС' поиск только по invNumber.
   * Для docType='ОСВ' поиск по invNumber + partyNumber + sn.
   *
   * @param {string} docType — тип документа ('ОС' или 'ОСВ')
   * @param {string} invNumber — инвентарный номер
   * @param {string} [partyNumber] — номер партии (только для ОСВ)
   * @param {string} [sn] — серийный номер (только для ОСВ)
   * @returns {Promise<Array>} массив найденных объектов (может быть пустым)
   */
  async findSimilarObjects(docType, invNumber, partyNumber, sn) {
    const params = new URLSearchParams({ docType, invNumber })
    if (partyNumber) params.append('partyNumber', partyNumber)
    if (sn) params.append('sn', sn)

    const data = await this.apiRequest(`/objects/find-similar?${params}`)
    return data.objects || []
  }  

  /**
   * Получает все объекты для указанного завода и склада
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Array>} Массив объектов
   */
  async getObjectsBySklad(zavod, sklad) {
    if (this.isFlightMode()) {
      // В офлайн-режиме берём из кэша
      return offlineCache.findObjectsByZavodSklad(zavod, sklad)
    }
    
    const data = await this.apiRequest(`/objects/sklad?zavod=${zavod}&sklad=${encodeURIComponent(sklad)}`)
    return data.objects || []
  }

  /**
   * Находит все объекты с указанным местоположением.
   * @param {Object} places — { placeTer, placePos, placeCab, placeUser }
   * @param {number} [excludeId] — ID объекта, который нужно исключить (текущий)
   * @returns {Promise<Array>} массив объектов
   */
  async getObjectsByPlaces(places, excludeId = null) {
    return this.isFlightMode()
      ? this.getObjectsByPlacesFromCache(places, excludeId)
      : this.getObjectsByPlacesFromApi(places, excludeId)
  }

  async getObjectsByPlacesFromCache(places, excludeId) {
    const all = await offlineCache.getAllObjects()
    return all.filter(obj =>
      obj.placeTer === places.placeTer &&
      obj.placePos === places.placePos &&
      obj.placeCab === places.placeCab &&
      obj.placeUser === places.placeUser &&
      obj.id !== excludeId
    )
  }

  async getObjectsByPlacesFromApi(places, excludeId) {
    const params = new URLSearchParams({
      placeTer: places.placeTer || '',
      placePos: places.placePos || '',
      placeCab: places.placeCab || '',
      placeUser: places.placeUser || ''
    })
    if (excludeId != null) params.append('excludeId', excludeId)
    const data = await this.apiRequest(`/objects/by-places?${params}`)
    return data.objects || []
  }

  //============================================================================
  // ПОЛУЧЕНИЕ МЕСТОПОЛОЖЕНИЙ
  //============================================================================

  /**
   * Менеджер: получает уникальные комбинации местоположений.
   * @returns {Promise<Array>} массив комбинаций { ter, pos, cab, user }.
   */
  async getPlaceCombinations() {
    return this.isFlightMode()
      ? this.getPlacesFromCache()
      : this.getPlacesFromApi()
  }

  /**
   * Исполнитель для офлайн: строит комбинации из данных IndexedDB.
   * Поля в БД: placeTer, placePos, placeCab, placeUser.
   * @returns {Promise<Array>} массив комбинаций { ter, pos, cab, user }.
   */
  async getPlacesFromCache() {
    const dbObjects = await offlineCache.getAllObjects()
    const map = new Map()

    for (const obj of dbObjects) {
      if (!obj.placeTer?.trim()) continue
      const key = [obj.placeTer, obj.placePos ?? '', obj.placeCab ?? '', obj.placeUser ?? ''].join('|')
      if (!map.has(key)) {
        map.set(key, {
          ter: obj.placeTer,
          pos: obj.placePos || null,
          cab: obj.placeCab || null,
          user: obj.placeUser || null
        })
      }
    }

    return Array.from(map.values())
  }

  /**
   * Исполнитель для онлайн: получает комбинации через API.
   * @returns {Promise<Array>} массив комбинаций.
   */
  async getPlacesFromApi() {
    const data = await this.apiRequest('/objects/place-combinations')
    return data.combinations || []
  }

  //============================================================================
  // УНИВЕРСАЛЬНОЕ СОХРАНЕНИЕ
  //============================================================================

  /**
   * Управляющий метод: создаёт или обновляет объект с фото и QR-кодами.
   * @param {Object} payload — расширенный DTO.
   * @param {Object} payload.objectData — данные объекта (может содержать id).
   * @param {Array<string>} [payload.qrCodes] — массив значений QR-кодов.
   * @param {Array<{max: string, min: string}>} [payload.photosToAdd] — новые фото в base64.
   * @param {Array<number>} [payload.photosToDelete] — ID фото для удаления.
   * @returns {Promise<Object>} сохранённый объект (camelCase).
   */
  async saveObject(payload) {
      const { objectData, qrCodes = [], photosToAdd = [], photosToDelete = [] } = payload
      const hasId = objectData.id != null

      console.log('[saveObject] isFlightMode:', this.isFlightMode(), 'hasId:', objectData.id != null)

      if (this.isFlightMode()) {
        return hasId
          ? this.updateInCache(objectData.id, { ...objectData, qrCodes, photosToAdd, photosToDelete })
          : this.createInCache({ ...objectData, qrCodes, photosToAdd })
      }

      if (hasId) {
        const { id, invNumber, buhName, sklad, zavod, partyNumber, ...updateData } = objectData
        return this.updateObject(id, { ...updateData, qrCodes, photosToAdd, photosToDelete })
      }

      const { id, ...createData } = objectData
      return this.createObject({ ...createData, qrCodes, photosToAdd })
  }

  //============================================================================
  // СОЗДАНИЕ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: создаёт новый объект.
   * @param {Object} objectData — данные объекта (camelCase).
   * @returns {Promise<Object>} созданный объект.
   */
  async createObject(objectData) {
    return this.isFlightMode()
      ? this.createInCache(objectData)
      : this.createInApi(objectData)
  }

  /**
   * Исполнитель для офлайн: создаёт объект в IndexedDB.
   * @param {Object} objectData — данные в camelCase.
   * @returns {Promise<Object>} созданный объект в camelCase.
   */
  async createInCache(objectData) {
      
      console.log('[createInCache] ВХОД, objectData:', JSON.stringify(objectData))
    
      const { qrCodes = [], photosToAdd = [], ...restData } = objectData

      const dbObject = {
        ...restData,
        id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        isWrittenOff: false,
        checkedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await offlineCache.db.transaction('rw',
        [offlineCache.db.objects, offlineCache.db.qr_codes, offlineCache.db.photos],
        async () => {

          console.log('[DEBUG createInCache] dbObject перед add:', JSON.stringify(dbObject))

          await offlineCache.db.objects.add(dbObject)

          for (const qrValue of qrCodes) {
            await offlineCache.saveQrCode({ qrValue, objectId: dbObject.id })
          }

          for (const photo of photosToAdd) {
            await offlineCache.savePhoto({
              objectId: dbObject.id,
              photoMaxData: photo.max,
              photoMinData: photo.min
            })
          }
        }
      )

      return { object: dbObject }
  }

  /**
   * Исполнитель для онлайн: создаёт объект через API.
   * @param {Object} objectData — данные в camelCase.
   * @returns {Promise<Object>} ответ API.
   */
  async createInApi(objectData) {
    const { id, ...dataToSend } = objectData
    const data = await this.apiRequest('/objects', { method: 'POST', body: dataToSend })
    return data.object
  }

  //============================================================================
  // ОБНОВЛЕНИЕ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: обновляет существующий объект.
   * @param {number} id — ID объекта.
   * @param {Object} updateData — данные для обновления (camelCase).
   * @returns {Promise<Object>} обновлённый объект.
   */
  async updateObject(id, updateData) {
    return this.isFlightMode()
      ? this.updateInCache(id, updateData)
      : this.updateInApi(id, updateData)
  }

  /**
   * Исполнитель для офлайн: обновляет объект в IndexedDB (PATCH-семантика).
   * @param {number} id — ID объекта.
   * @param {Object} updateData — данные для обновления (camelCase).
   * @returns {Promise<Object>} обновлённый объект в camelCase.
   */
  async updateInCache(id, updateData) {
      const { qrCodes = [], photosToAdd = [], photosToDelete = [], ...restData } = updateData

      const updatedDbObject = await offlineCache.db.transaction('rw',
        [offlineCache.db.objects, offlineCache.db.qr_codes, offlineCache.db.photos],
        async () => {
          const existing = await offlineCache.getObject(id)
          if (!existing) throw new Error(`Объект с ID ${id} не найден в кэше`)

          const patched = {
            ...existing,
            ...restData,
            updatedAt: new Date().toISOString()
          }

          const saved = await offlineCache.updateObject(id, patched)

          for (const qrValue of qrCodes) {
            await offlineCache.saveQrCode({ qrValue, objectId: id })
          }

          for (const photoId of photosToDelete) {
            await offlineCache.deletePhoto(photoId)
          }

          for (const photo of photosToAdd) {
            await offlineCache.savePhoto({
              objectId: id,
              photoMaxData: photo.max,
              photoMinData: photo.min
            })
          }

          return saved
        }
      )

      return { object: updatedDbObject }
  }

  /**
   * Исполнитель для онлайн: обновляет объект через API.
   * @param {number} id — ID объекта.
   * @param {Object} updateData — данные в camelCase.
   * @returns {Promise<Object>} ответ API.
   */
  async updateInApi(id, updateData) {
    return this.apiRequest(`/objects/${id}`, { method: 'PATCH', body: updateData })
  }

  //============================================================================
  // ОБНОВЛЕНИЕ ДАТЫ ПРОВЕРКИ
  //============================================================================

  /**
   * Менеджер: обновляет дату проверки объекта.
   * @param {string|number} id — ID объекта.
   * @returns {Promise<Object>} обновлённый объект.
   */
  async updateCheckedAt(id) {
    const objectId = Number(id)
    const checkedAt = new Date().toISOString()
    return this.isFlightMode()
      ? this.updateCheckedAtInCache(objectId, checkedAt)
      : this.updateCheckedAtInApi(objectId, checkedAt)
  }

  /**
   * Исполнитель для офлайн: обновляет checkedAt в IndexedDB.
   * @param {number} id — ID объекта.
   * @param {string} checkedAt — ISO-дата.
   * @returns {Promise<Object>} обновлённый объект в camelCase.
   */
  async updateCheckedAtInCache(id, checkedAt) {
    const existing = await offlineCache.getObject(id)
    if (!existing) throw new Error(`Объект с ID ${id} не найден в кэше`)

    const updated = await offlineCache.updateObject(id, {
      checkedAt: checkedAt,
      updatedAt: checkedAt
    })

    return updated
  }

  /**
   * Исполнитель для онлайн: обновляет checkedAt через API.
   * @param {number} id — ID объекта.
   * @param {string} checkedAt — ISO-дата.
   * @returns {Promise<Object>} ответ API.
   */
  async updateCheckedAtInApi(id, checkedAt) {
    return this.apiRequest(`/objects/${id}`, {
      method: 'PATCH',
      body: { checkedAt }
    })
  }
}

// Экспортируем синглтон
export const objectService = new ObjectService()