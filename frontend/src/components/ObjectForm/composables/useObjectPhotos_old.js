/**
 * Композабл для работы с фотографиями объектов
 * Добавление, удаление, отображение в карусели
 */
import { ref } from 'vue'
import { photoService } from '@/services/PhotoService.js'

export function useObjectPhotos(objectId = null) {
  const photos = ref([])
  const isLoading = ref(false)
  const isUploading = ref(false)
  const error = ref(null)

  /**
   * Загружает фотографии объекта
   */
  const loadPhotos = async (targetObjectId = objectId) => {
    if (!targetObjectId) {
      photos.value = []
      return
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // TODO: Заменить на реальный API-вызов
      photos.value = await photoService.getObjectPhotos(targetObjectId)
    } catch (err) {
      error.value = `Ошибка загрузки фото: ${err.message}`
      console.error('Ошибка загрузки фото:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Добавляет новую фотографию к объекту
   */
  const addPhoto = async (targetObjectId = objectId) => {
    if (!targetObjectId) {
      error.value = 'Не указан объект'
      return false
    }
    
    isUploading.value = true
    error.value = null
    
    try {
      // TODO: Реальная загрузка через камеру или галерею
      // Временная заглушка
      alert('Добавление фото (функционал в разработке)')
      
      // Имитация успешной загрузки
      const newPhoto = {
        id: Date.now(),
        url: 'https://via.placeholder.com/150',
        thumbUrl: 'https://via.placeholder.com/50',
        uploaded_at: new Date().toISOString()
      }
      
      photos.value.push(newPhoto)
      return true
      
    } catch (err) {
      error.value = `Ошибка загрузки фото: ${err.message}`
      console.error('Ошибка добавления фото:', err)
      return false
    } finally {
      isUploading.value = false
    }
  }

  /**
   * Удаляет фотографию
   */
  const removePhoto = async (photoIndex) => {
    if (photoIndex < 0 || photoIndex >= photos.value.length) return
    
    try {
      const photo = photos.value[photoIndex]
      
      // TODO: Удаление через API
      if (photo.id) {
        await photoService.deletePhoto(photo.id)
      }
      
      photos.value.splice(photoIndex, 1)
      return true
    } catch (err) {
      error.value = `Ошибка удаления фото: ${err.message}`
      console.error('Ошибка удаления фото:', err)
      return false
    }
  }

  return {
    photos,
    isLoading,
    isUploading,
    error,
    loadPhotos,
    addPhoto,
    removePhoto
  }
}