/**
 * Сервис для работы с фотографиями объектов
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 * 
 * ВНИМАНИЕ: Модалка НЕ вызывает uploadPhoto и deletePhoto напрямую.
 * Эти методы используются ТОЛЬКО для синхронизации офлайн-изменений.
 * 
 * Фото сохраняются и удаляются через комбинированный saveObject в objectService.
 */

import { offlineCache } from './offline-cache-service'

export class PhotoService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean}
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для запросов к API
   * @param {string} endpoint - API endpoint (без /api/)
   * @param {Object} options - Параметры запроса
   * @returns {Promise<any>}
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    }
    
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const requestOptions = {
      method: 'GET',
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions)

    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`)
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null
    }

    return await response.json()
  }

  //============================================================================
  // КОНВЕРТАЦИЯ BLOB <-> ARRAYBUFFER (ДЛЯ КЭША)
  //============================================================================

  /**
   * Преобразует Blob в ArrayBuffer
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

  /**
   * Преобразует ArrayBuffer в Blob
   * @param {ArrayBuffer} buffer
   * @param {string} type - MIME тип
   * @returns {Blob}
   */
  arrayBufferToBlob(buffer, type = 'image/jpeg') {
    return new Blob([buffer], { type })
  }

  //============================================================================
  // ЗАГРУЗКА ФОТО ЧЕРЕЗ FETCH (ОНЛАЙН-РЕЖИМ)
  //============================================================================

  /**
   * Загружает фото через fetch с токеном, возвращает Blob
   * @param {number} photoId - ID фото
   * @param {string} type - 'full' или 'thumb'
   * @returns {Promise<Blob>}
   */
  async fetchPhotoBlob(photoId, type = 'full') {
    const endpoint = type === 'thumb' 
      ? `/photos/${photoId}/thumbnail` 
      : `/photos/${photoId}`
    
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.blob()
  }

  /**
   * Создаёт временный ObjectURL для фото
   * @param {number} photoId - ID фото
   * @param {string} type - 'full' или 'thumb'
   * @returns {Promise<{url: string, revoke: Function}>}
   */
  async createObjectURL(photoId, type = 'full') {
    const blob = await this.fetchPhotoBlob(photoId, type)
    const url = URL.createObjectURL(blob)
    return {
      url,
      revoke: () => URL.revokeObjectURL(url)
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ФОТОГРАФИЙ ОБЪЕКТА
  //============================================================================

  /**
   * Получает фотографии объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>} Массив фотографий с методами getUrl/getThumbUrl/revoke
   */
  async getObjectPhotos(objectId) {
    if (this.isFlightMode()) {
      console.log(`[PhotoService] Офлайн-режим: получение фото объекта ${objectId} из кэша`)
      return this.getFromCache(objectId)
    }
    
    console.log(`[PhotoService] Онлайн-режим: получение фото объекта ${objectId} с сервера`)
    return this.getFromApi(objectId)
  }

  /**
   * Офлайн: получает фото из IndexedDB
   */
  async getFromCache(objectId) {
    try {
      const photos = await offlineCache.getPhotosByObjectId(objectId)
      
      const photosWithUrls = photos.map(photo => {
        const maxBlob = new Blob([photo.photoMaxData], { type: 'image/jpeg' })
        const minBlob = new Blob([photo.photoMinData], { type: 'image/jpeg' })
        
        const url = URL.createObjectURL(maxBlob)
        const thumbUrl = URL.createObjectURL(minBlob)
        
        return {
          id: photo.id,
          objectId: photo.objectId,
          url: url,
          thumbUrl: thumbUrl,
          revoke() {
            URL.revokeObjectURL(url)
            URL.revokeObjectURL(thumbUrl)
          },
          uploadedAt: photo.createdAt
        }
      })
      
      console.log(`[PhotoService] Из кэша загружено фото: ${photosWithUrls.length}`)
      return photosWithUrls
      
    } catch (error) {
      console.error('[PhotoService] Ошибка получения фото из кэша:', error)
      throw new Error('Не удалось загрузить фото из кэша')
    }
  }

  /**
   * Онлайн: получает фото через API
   * Возвращает объекты с асинхронными геттерами getUrl() и getThumbUrl()
   */
  async getFromApi(objectId) {
    try {
      const photos = await this.apiRequest(`/photos/object/${objectId}`)
      
      const self = this
      
      const photosWithLoaders = photos.map(photo => {
        let currentUrl = null
        let currentThumbUrl = null
        let revokeFull = null
        let revokeThumb = null
        
        return {
          id: photo.id,
          objectId: photo.objectId,
          
          async getUrl() {
            if (currentUrl) return currentUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'full')
            currentUrl = url
            revokeFull = revoke
            return url
          },
          
          async getThumbUrl() {
            if (currentThumbUrl) return currentThumbUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'thumb')
            currentThumbUrl = url
            revokeThumb = revoke
            return url
          },
          
          revoke() {
            if (revokeFull) {
              revokeFull()
              revokeFull = null
            }
            if (revokeThumb) {
              revokeThumb()
              revokeThumb = null
            }
            currentUrl = null
            currentThumbUrl = null
          },
          
          uploadedAt: photo.createdAt
        }
      })
      
      console.log(`[PhotoService] С сервера загружено фото: ${photosWithLoaders.length}`)
      return photosWithLoaders
      
    } catch (error) {
      console.error('[PhotoService] Ошибка получения фото через API:', error)
      throw error
    }
  }

  //============================================================================
  // МЕТОДЫ ДЛЯ СИНХРОНИЗАЦИИ ОФЛАЙН-ИЗМЕНЕНИЙ
  // (НЕ ИСПОЛЬЗУЮТСЯ В МОДАЛКЕ, ТОЛЬКО ПРИ ВЫХОДЕ ИЗ ОФЛАЙН-РЕЖИМА)
  //============================================================================

  /**
   * Загружает фото на сервер (для синхронизации)
   * @param {number} objectId - ID объекта
   * @param {Blob} fileBlob - Blob полноразмерного фото
   * @param {Blob} thumbBlob - Blob миниатюры
   * @returns {Promise<Object>}
   */
  async uploadPhoto(objectId, fileBlob, thumbBlob) {
    if (this.isFlightMode()) {
      throw new Error('uploadPhoto не вызывается в офлайн-режиме напрямую')
    }
    
    console.log(`[PhotoService] Синхронизация: загрузка фото для объекта ${objectId}`)
    
    const formData = new FormData()
    formData.append('photo', fileBlob, 'photo.jpg')
    
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${this.baseUrl}/photos?objectId=${objectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.photoId) {
      throw new Error(data.message || 'Ошибка загрузки фотографии')
    }
    
    return data
  }

  /**
   * Удаляет фото на сервере (для синхронизации)
   * @param {number} photoId - ID фото
   * @returns {Promise<boolean>}
   */
  async deletePhoto(photoId) {
    if (this.isFlightMode()) {
      throw new Error('deletePhoto не вызывается в офлайн-режиме напрямую')
    }
    
    console.log(`[PhotoService] Синхронизация: удаление фото ${photoId}`)
    
    await this.apiRequest(`/photos/${photoId}`, {
      method: 'DELETE'
    })
    
    return true
  }
}

// Экспортируем синглтон
export const photoService = new PhotoService()