/**
 * Сервис для работы с фотографиями объектов.
 * Поддерживает онлайн/офлайн режимы работы.
 *
 * Онлайн (flightMode = false): все запросы к API.
 * Офлайн (flightMode = true): все операции в IndexedDB.
 *
 * Фото сохраняются и удаляются через комбинированный saveObject в objectService.
 * В IndexedDB фото хранятся в формате base64.
 *
 * Синхронизация офлайн-изменений — в отдельной задаче.
 */
import { offlineCache } from './offline-cache-service'

export class PhotoService {
  constructor() {
    this.baseUrl = '/api'
  }

  //============================================================================
  // УТИЛИТЫ
  //============================================================================

  /**
   * Проверяет, активен ли режим полёта.
   * @returns {boolean} true — офлайн, false — онлайн.
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для запросов к API.
   * @param {string} endpoint — путь без /api/.
   * @param {Object} [options] — параметры fetch.
   * @returns {Promise<any>} тело ответа.
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const headers = { 'Authorization': `Bearer ${token}` }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      ...options,
      headers: { ...headers, ...options.headers }
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)
    if (response.status === 204 || response.headers.get('content-length') === '0') return null
    return await response.json()
  }

  /**
   * Конвертирует base64-строку в Blob.
   * @param {string} base64 — строка без префикса data:...;base64,.
   * @param {string} [type='image/jpeg'] — MIME-тип.
   * @returns {Blob}
   */
  base64ToBlob(base64, type = 'image/jpeg') {
    const chars = atob(base64)
    const bytes = new Uint8Array(chars.length)
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i)
    return new Blob([bytes], { type })
  }

  //============================================================================
  // ЗАГРУЗКА ФОТО (ОНЛАЙН-РЕЖИМ)
  //============================================================================

  /**
   * Загружает фото через fetch с токеном, возвращает Blob.
   * @param {number} photoId — ID фото.
   * @param {string} [type='full'] — 'full' или 'thumb'.
   * @returns {Promise<Blob>}
   */
  async fetchPhotoBlob(photoId, type = 'full') {
    const endpoint = type === 'thumb' ? `/photos/${photoId}/thumbnail` : `/photos/${photoId}`
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return await response.blob()
  }

  /**
   * Создаёт временный ObjectURL для фото.
   * @param {number} photoId — ID фото.
   * @param {string} [type='full'] — 'full' или 'thumb'.
   * @returns {Promise<{url: string, revoke: Function}>}
   */
  async createObjectURL(photoId, type = 'full') {
    const blob = await this.fetchPhotoBlob(photoId, type)
    const url = URL.createObjectURL(blob)
    return { url, revoke: () => URL.revokeObjectURL(url) }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ФОТОГРАФИЙ ОБЪЕКТА
  //============================================================================

  /**
   * Менеджер: получает фотографии объекта.
   * @param {number} objectId — ID объекта.
   * @returns {Promise<Array>} массив фотографий с url/thumbUrl/revoke.
   */
  async getObjectPhotos(objectId) {
    return this.isFlightMode()
      ? this.getObjectPhotosFromCache(objectId)
      : this.getObjectPhotosFromApi(objectId)
  }

  /**
   * Исполнитель для офлайн: получает фото из IndexedDB.
   * @param {number} objectId — ID объекта.
   * @returns {Promise<Array>} массив фотографий с url/thumbUrl/revoke.
   */
  async getObjectPhotosFromCache(objectId) {
      try {
        const photos = await offlineCache.getPhotosByObjectId(objectId)

        const photosWithLoaders = photos.map(photo => {
          let currentUrl = null
          let currentThumbUrl = null

          const getUrl = () => {
            if (!currentUrl) {
              const blob = this.base64ToBlob(photo.photoMaxData)
              currentUrl = URL.createObjectURL(blob)
            }
            return currentUrl
          }

          const getThumbUrl = () => {
            if (!currentThumbUrl) {
              const blob = this.base64ToBlob(photo.photoMinData)
              currentThumbUrl = URL.createObjectURL(blob)
            }
            return currentThumbUrl
          }

          return {
            id: photo.id,
            objectId: photo.objectId,
            getUrl,
            getThumbUrl,
            revoke() {
              if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null }
              if (currentThumbUrl) { URL.revokeObjectURL(currentThumbUrl); currentThumbUrl = null }
            },
            uploadedAt: photo.createdAt
          }
        })

        console.log(`[PhotoService] Из кэша загружено фото: ${photosWithLoaders.length}`)
        return photosWithLoaders
      } catch (error) {
        console.error('[PhotoService] Ошибка получения фото из кэша:', error)
        throw new Error('Не удалось загрузить фото из кэша')
      }
  }

  /**
   * Исполнитель для онлайн: получает фото через API.
   * @param {number} objectId — ID объекта.
   * @returns {Promise<Array>} массив фотографий с getUrl/getThumbUrl/revoke.
   */
  async getObjectPhotosFromApi(objectId) {
    try {
      const photos = await this.apiRequest(`/photos/object/${objectId}`)
      const self = this

      return photos.map(photo => {
        let currentUrl = null
        let currentThumbUrl = null
        let revokeFull = null
        let revokeThumb = null

        return {
          id: photo.id,
          objectId: photo.objectId,

          async getThumbUrl() {
            if (currentThumbUrl) return currentThumbUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'thumb')
            currentThumbUrl = url
            revokeThumb = revoke
            return url
          },

          async getUrl() {
            if (currentUrl) return currentUrl
            const { url, revoke } = await self.createObjectURL(photo.id, 'full')
            currentUrl = url
            revokeFull = revoke
            return url
          },

          revoke() {
            if (revokeFull) { revokeFull(); revokeFull = null }
            if (revokeThumb) { revokeThumb(); revokeThumb = null }
            currentUrl = null
            currentThumbUrl = null
          },

          uploadedAt: photo.createdAt
        }
      })
    } catch (error) {
      console.error('[PhotoService] Ошибка получения фото через API:', error)
      throw error
    }
  }

  //============================================================================
  // СИНХРОНИЗАЦИЯ ОФЛАЙН-ИЗМЕНЕНИЙ (заглушки, будут реализованы позже)
  //============================================================================

  /**
   * Загружает фото на сервер (для синхронизации).
   * @param {number} objectId — ID объекта.
   * @param {string} maxBase64 — полноразмерное фото в base64.
   * @param {string} minBase64 — миниатюра в base64.
   * @returns {Promise<Object>}
   */
  async uploadPhoto(objectId, maxBase64, minBase64) {
    if (this.isFlightMode()) {
      throw new Error('uploadPhoto не вызывается в офлайн-режиме напрямую')
    }

    console.log(`[PhotoService] Синхронизация: загрузка фото для объекта ${objectId}`)

    const formData = new FormData()
    formData.append('photo', this.base64ToBlob(maxBase64), 'photo.jpg')
    formData.append('thumbnail', this.base64ToBlob(minBase64), 'thumb.jpg')

    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${this.baseUrl}/photos?objectId=${objectId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)

    const data = await response.json()
    if (!data.photoId) throw new Error(data.message || 'Ошибка загрузки фотографии')
    return data
  }

  /**
   * Удаляет фото на сервере (для синхронизации).
   * @param {number} photoId — ID фото.
   * @returns {Promise<boolean>}
   */
  async deletePhoto(photoId) {
    if (this.isFlightMode()) {
      throw new Error('deletePhoto не вызывается в офлайн-режиме напрямую')
    }

    console.log(`[PhotoService] Синхронизация: удаление фото ${photoId}`)
    await this.apiRequest(`/photos/${photoId}`, { method: 'DELETE' })
    return true
  }
}

// Экспортируем синглтон
export const photoService = new PhotoService()