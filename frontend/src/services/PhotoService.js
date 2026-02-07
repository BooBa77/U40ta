/**
 * Сервис для работы с фотографиями объектов
 */
class PhotoService {
  constructor() {
    this.baseUrl = '/api/photos'
  }

  /**
   * Получает фотографии объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Object[]>} Массив фотографий
   */
  async getObjectPhotos(objectId) {
    console.log(`[PhotoService] Получение фото объекта ${objectId}`)
    
    // TODO: Реальный API-запрос
    // Временные данные
    return [
      {
        id: 1,
        object_id: objectId,
        url: 'https://via.placeholder.com/800x600/3b82f6/ffffff?text=Фото+1',
        thumbUrl: 'https://via.placeholder.com/150/3b82f6/ffffff?text=1',
        uploaded_at: '2024-01-15T10:30:00Z'
      },
      {
        id: 2,
        object_id: objectId,
        url: 'https://via.placeholder.com/800x600/10b981/ffffff?text=Фото+2',
        thumbUrl: 'https://via.placeholder.com/150/10b981/ffffff?text=2',
        uploaded_at: '2024-01-16T14:45:00Z'
      }
    ]
  }

  /**
   * Загружает фотографию для объекта
   * @param {number} objectId - ID объекта
   * @param {File} file - Файл фотографии
   * @returns {Promise<Object>} Информация о загруженной фотографии
   */
  async uploadPhoto(objectId, file) {
    console.log(`[PhotoService] Загрузка фото для объекта ${objectId}`, file)
    
    // TODO: Реальная загрузка на сервер
    await this._simulateDelay(1000)
    
    return {
      id: Date.now(),
      object_id: objectId,
      url: URL.createObjectURL(file),
      thumbUrl: URL.createObjectURL(file),
      uploaded_at: new Date().toISOString(),
      file_name: file.name,
      file_size: file.size
    }
  }

  /**
   * Удаляет фотографию
   * @param {number} photoId - ID фотографии
   * @returns {Promise<boolean>} true если успешно
   */
  async deletePhoto(photoId) {
    console.log(`[PhotoService] Удаление фото ${photoId}`)
    
    // TODO: Реальный API-запрос
    await this._simulateDelay()
    
    return true
  }

  /**
   * Имитация задержки сети/обработки
   */
  async _simulateDelay(ms = 300) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const photoService = new PhotoService()