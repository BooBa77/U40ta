/**
 * Сервис для работы с фотографиями объектов
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

export class PhotoService {
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

    // Если статус 204 (No Content) или ответ пустой
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null
    }

    return await response.json()
  }

  /**
   * Преобразует Blob в ArrayBuffer для сохранения в IndexedDB
   * @param {Blob} blob - Blob изображения
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
   * Преобразует ArrayBuffer в Blob для отображения
   * @param {ArrayBuffer} buffer - ArrayBuffer изображения
   * @param {string} type - MIME тип
   * @returns {Blob}
   */
  arrayBufferToBlob(buffer, type = 'image/jpeg') {
    return new Blob([buffer], { type })
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ФОТОГРАФИЙ ОБЪЕКТА
  //============================================================================

  /**
   * Получает фотографии объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>} Массив фотографий
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
      
      // Преобразуем ArrayBuffer в ObjectURL для отображения
      const photosWithUrls = photos.map(photo => ({
        id: photo.id,
        object_id: photo.object_id,
        url: URL.createObjectURL(this.arrayBufferToBlob(photo.photo_max_data)),
        thumbUrl: URL.createObjectURL(this.arrayBufferToBlob(photo.photo_min_data)),
        uploaded_at: photo.created_at
      }))
      
      console.log(`[PhotoService] Из кэша загружено фото: ${photosWithUrls.length}`)
      return photosWithUrls
      
    } catch (error) {
      console.error('[PhotoService] Ошибка получения фото из кэша:', error)
      throw new Error('Не удалось загрузить фото из кэша')
    }
  }

  /**
   * Онлайн: получает фото через API
   */

  async getFromApi(objectId) {
    try {
      const photos = await this.apiRequest(`/photos/object/${objectId}`)
      
      // photos — это уже массив, без обёртки
      const photosWithUrls = photos.map(photo => ({
        id: photo.id,
        object_id: photo.object_id,
        url: `/api/photos/${photo.id}`,
        thumbUrl: `/api/photos/${photo.id}/thumbnail`,
        uploaded_at: photo.created_at
      }))
      
      console.log(`[PhotoService] С сервера загружено фото: ${photosWithUrls.length}`)
      return photosWithUrls
      
    } catch (error) {
      console.error('[PhotoService] Ошибка получения фото через API:', error)
      throw error
    }
  }

  //============================================================================
  // ВЫГРУЗКА ФОТОГРАФИИ
  //============================================================================

  /**
   * Выгружает фотографию для объекта
   * @param {number} objectId - ID объекта
   * @param {Blob} fileBlob - Blob фотографии (полноразмерное)
   * @param {Blob} thumbBlob - Blob миниатюры (опционально)
   * @returns {Promise<Object>} Информация о загруженной фотографии
   */
  async uploadPhoto(objectId, fileBlob, thumbBlob = null) {
    if (this.isFlightMode()) {
      console.log(`[PhotoService] Офлайн-режим: сохранение фото в кэш для объекта ${objectId}`)
      return this.uploadToCache(objectId, fileBlob, thumbBlob)
    }
    
    console.log(`[PhotoService] Онлайн-режим: загрузка фото на сервер для объекта ${objectId}`)
    return this.uploadToApi(objectId, fileBlob, thumbBlob)
  }

  /**
   * Офлайн: сохраняет фото в IndexedDB
   */
  async uploadToCache(objectId, fileBlob, thumbBlob) {
    try {
      const minBlob = thumbBlob || fileBlob
      
      const photoForCache = {
        id: Date.now(), // временный ID
        object_id: objectId,
        created_at: new Date().toISOString(),
        created_by: null,
        photo_max_data: await this.blobToArrayBuffer(fileBlob),
        photo_min_data: await this.blobToArrayBuffer(minBlob)
      }
      
      await offlineCache.savePhoto(photoForCache)
      
      console.log(`[PhotoService] Фото сохранено в кэш для объекта ${objectId}`)
      
      return {
        id: photoForCache.id,
        object_id: objectId,
        url: URL.createObjectURL(fileBlob),
        thumbUrl: URL.createObjectURL(minBlob),
        uploaded_at: photoForCache.created_at
      }
      
    } catch (error) {
      console.error('[PhotoService] Ошибка сохранения фото в кэш:', error)
      throw new Error('Не удалось сохранить фото в кэше')
    }
  }

  /**
   * Онлайн: загружает фото через API
   */

  async uploadToApi(objectId, fileBlob, thumbBlob) {
    try {
      const formData = new FormData()
      formData.append('photo', fileBlob, 'photo.jpg')
      // thumbBlob не отправляем, бэкенд сам создаёт миниатюру
      
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
      
      // Бэкенд возвращает { message: '...', photoId: id }
      if (!data.photoId) {
        throw new Error(data.message || 'Ошибка загрузки фотографии')
      }
      
      console.log(`[PhotoService] Фото загружено через API, ID: ${data.photoId}`)
      
      return {
        id: data.photoId,
        object_id: objectId,
        url: `/api/photos/${data.photoId}`,
        thumbUrl: `/api/photos/${data.photoId}/thumbnail`,
        uploaded_at: new Date().toISOString()
      }
      
    } catch (error) {
      console.error('[PhotoService] Ошибка загрузки фото через API:', error)
      throw error
    }
  }

  //============================================================================
  // УДАЛЕНИЕ ФОТОГРАФИИ
  //============================================================================

  /**
   * Удаляет фотографию
   * @param {number} photoId - ID фотографии
   * @returns {Promise<boolean>} true если успешно
   */
  async deletePhoto(photoId) {
    if (this.isFlightMode()) {
      console.log(`[PhotoService] Офлайн-режим: удаление фото ${photoId} из кэша`)
      return this.deleteFromCache(photoId)
    }
    
    console.log(`[PhotoService] Онлайн-режим: удаление фото ${photoId} с сервера`)
    return this.deleteFromApi(photoId)
  }

  /**
   * Офлайн: удаляет фото из IndexedDB
   */
  async deleteFromCache(photoId) {
    try {
      await offlineCache.deletePhoto(photoId)
      console.log(`[PhotoService] Фото ${photoId} удалено из кэша`)
      return true
    } catch (error) {
      console.error('[PhotoService] Ошибка удаления фото из кэша:', error)
      throw new Error('Не удалось удалить фото из кэша')
    }
  }

  /**
   * Онлайн: удаляет фото через API
   */
  async deleteFromApi(photoId) {
    try {
      await this.apiRequest(`/photos/${photoId}`, {
        method: 'DELETE'
      })
      
      console.log(`[PhotoService] Фото ${photoId} удалено через API`)
      return true
      
    } catch (error) {
      console.error('[PhotoService] Ошибка удаления фото через API:', error)
      throw error
    }
  }

}



// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С URL ФОТО
// ============================================================================

/**
 * Преобразует относительный путь фото в полный URL
 * @param {string} path - Относительный путь (например, "/api/photos/1")
 * @param {PhotoService} service - Экземпляр сервиса (для доступа к baseUrl)
 * @returns {string|null} Полный URL
 */
function getFullPhotoUrl(path, service = photoService) {
  if (!path) return null
  if (path.startsWith('blob:')) return path
  if (path.startsWith('http')) return path
  
  // Для относительных путей добавляем baseUrl
  // Убираем возможный дублирующийся слеш
  const baseUrl = service.baseUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

/**
 * Создает временный URL из Blob и возвращает объект с URL и функцией очистки
 * @param {Blob} blob - Blob изображения
 * @returns {Object} { url, revoke } - URL и функция очистки
 */
function createTemporaryPhotoUrl(blob) {
  if (!blob || !(blob instanceof Blob)) {
    return { url: null, revoke: () => {} }
  }
  
  const url = URL.createObjectURL(blob)
  return {
    url,
    revoke: () => URL.revokeObjectURL(url)
  }
}

// Экспортируем синглтон
export const photoService = new PhotoService()
export {
  getFullPhotoUrl,
  createTemporaryPhotoUrl
}