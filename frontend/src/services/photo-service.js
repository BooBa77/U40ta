/**
 * Сервис для работы с фотографиями объектов
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 * 
 * Для онлайн-режима: фото загружаются через fetch с токеном, затем создаются ObjectURL
 * Это решает проблему 401 в production, т.к. браузер не передаёт Authorization в <img src>
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
      
      // Из кэша приходят ArrayBuffer, преобразуем в Blob и ObjectURL
      const photosWithUrls = photos.map(photo => {
        const maxBlob = new Blob([photo.photo_max_data], { type: 'image/jpeg' })
        const minBlob = new Blob([photo.photo_min_data], { type: 'image/jpeg' })
        
        const url = URL.createObjectURL(maxBlob)
        const thumbUrl = URL.createObjectURL(minBlob)
        
        return {
          id: photo.id,
          object_id: photo.object_id,
          url: url,
          thumbUrl: thumbUrl,
          // Метод для освобождения памяти
          revoke() {
            URL.revokeObjectURL(url)
            URL.revokeObjectURL(thumbUrl)
          },
          uploaded_at: photo.created_at
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
   * Это решает проблему 401, т.к. фото загружаются через fetch с токеном
   */
  async getFromApi(objectId) {
    try {
      const photos = await this.apiRequest(`/photos/object/${objectId}`)
      
      // Сохраняем ссылку на this для использования внутри замыканий
      const self = this
      
      // photos — это уже массив, без обёртки
      const photosWithLoaders = photos.map(photo => {
        let currentUrl = null
        let currentThumbUrl = null
        let revokeFull = null
        let revokeThumb = null
        
        return {
          id: photo.id,
          object_id: photo.object_id,
          
          /**
           * Асинхронно получает URL полноразмерного фото
           * @returns {Promise<string>}
           */
          async getUrl() {
            if (currentUrl) return currentUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'full')
            currentUrl = url
            revokeFull = revoke
            return url
          },
          
          /**
           * Асинхронно получает URL миниатюры
           * @returns {Promise<string>}
           */
          async getThumbUrl() {
            if (currentThumbUrl) return currentThumbUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'thumb')
            currentThumbUrl = url
            revokeThumb = revoke
            return url
          },
          
          /**
           * Освобождает ObjectURL и память
           * Обязательно вызывать при уничтожении компонента
           */
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
          
          uploaded_at: photo.created_at
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
      
      // Сохраняем ссылку на this для замыкания
      const self = this
      const photoId = data.photoId
      
      return {
        id: photoId,
        object_id: objectId,
        // Возвращаем объект с методами для совместимости
        async getUrl() {
          const { url, revoke } = await self.createObjectURL(photoId, 'full')
          // Сохраняем revoke для последующей очистки
          this._revokeFull = revoke
          return url
        },
        async getThumbUrl() {
          const { url, revoke } = await self.createObjectURL(photoId, 'thumb')
          this._revokeThumb = revoke
          return url
        },
        revoke() {
          if (this._revokeFull) {
            this._revokeFull()
            this._revokeFull = null
          }
          if (this._revokeThumb) {
            this._revokeThumb()
            this._revokeThumb = null
          }
        },
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