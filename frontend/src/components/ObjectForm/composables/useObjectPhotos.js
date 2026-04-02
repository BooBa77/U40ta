import { ref } from 'vue'
import { photoService } from '@/services/photo-service.js'

export function useObjectPhotos() {
  const photos = ref([])
  const isProcessing = ref(false)
  const isLoading = ref(false)
  const loadError = ref(null)

  // Функция создания миниатюры (только для новых фото с камеры)
  const createThumbnail = (blob, size) => {
    return new Promise((resolve, reject) => {
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        reject(new Error('Некорректные данные изображения'))
        return
      }

      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        
        const ctx = canvas.getContext('2d')
        const scale = Math.max(size / img.width, size / img.height)
        const x = (size - img.width * scale) / 2
        const y = (size - img.height * scale) / 2
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        
        canvas.toBlob((thumbnailBlob) => {
          URL.revokeObjectURL(img.src)
          resolve(thumbnailBlob)
        }, 'image/jpeg', 0.8)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src)
        reject(new Error('Ошибка загрузки изображения'))
      }
      
      img.src = URL.createObjectURL(blob)
    })
  }

  // Функция загрузки фотографий с сервера
  const loadPhotos = async (objectId) => {
    if (!objectId) return
    
    isLoading.value = true
    loadError.value = null
    
    try {
      const serverPhotos = await photoService.getObjectPhotos(objectId)
      
      // Освобождаем старые URL перед очисткой
      photos.value.forEach(p => {
        if (p.min?.startsWith('blob:')) URL.revokeObjectURL(p.min)
        if (p.max?.startsWith('blob:')) URL.revokeObjectURL(p.max)
        // Также revoke через photoObject если есть
        if (p._photoObject) {
          p._photoObject.revoke()
        }
      })
      
      // Сохраняем фото с асинхронными геттерами
      photos.value = serverPhotos.map(photo => ({
        id: photo.id,
        _photoObject: photo,           // сохраняем оригинал для вызова revoke и getUrl
        min: null,                     // будет заполнено асинхронно
        max: null,                     // будет заполнено по требованию
        _loadingMin: false,            // флаг для предотвращения дублирования загрузки
        isDeleted: false
      }))
      
      // Асинхронно загружаем миниатюры (не блокируем рендер)
      for (const p of photos.value) {
        if (!p.min && !p._loadingMin) {
          p._loadingMin = true
          try {
            p.min = await p._photoObject.getThumbUrl()
          } catch (error) {
            console.error(`Ошибка загрузки миниатюры для фото ${p.id}:`, error)
            // Можно поставить плейсхолдер
            p.min = null
          } finally {
            p._loadingMin = false
          }
        }
      }
      
    } catch (error) {
      loadError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Получить полноразмерное фото для просмотра
   * @param {Object} photoItem - элемент из photos.value
   * @returns {Promise<string|null>} URL фото
   */
  const getFullPhotoUrl = async (photoItem) => {
    if (!photoItem || !photoItem._photoObject) return null
    if (photoItem.max) return photoItem.max
    
    try {
      photoItem.max = await photoItem._photoObject.getUrl()
      return photoItem.max
    } catch (error) {
      console.error(`Ошибка загрузки полноразмерного фото ${photoItem.id}:`, error)
      return null
    }
  }
  
  // Добавление фотографии с камеры (новое фото, ещё не на сервере)
  const addPhoto = async (photoBlob) => {
    if (isProcessing.value) return
    
    try {
      isProcessing.value = true
      
      const minBlob = await createThumbnail(photoBlob, 150)
      const minUrl = URL.createObjectURL(minBlob)
      const maxUrl = URL.createObjectURL(photoBlob)
      
      photos.value.push({
        id: null,
        min: minUrl,
        max: maxUrl,
        _photoObject: null,           // для новых фото нет _photoObject
        _raw: {
          min: minBlob,
          max: photoBlob
        },
        isDeleted: false
      })
      
    } catch (error) {
      console.error('Ошибка при обработке фото:', error)
      throw error
    } finally {
      isProcessing.value = false
    }
  }

  // Пометить/снять пометку на удаление
  const toggleDeleteMark = (index) => {
    if (index < 0 || index >= photos.value.length) return
    const photo = photos.value[index]
    photo.isDeleted = !photo.isDeleted
  }

  // Сохранение изменений
  const savePhotosChanges = async (objectId) => {
    if (!objectId) return { uploaded: [], deleted: [] }
    
    const uploaded = []
    const deleted = []
    
    // 1. Удаляем помеченные фото (только те, у которых есть id на сервере)
    const toDelete = photos.value.filter(p => p.id !== null && p.isDeleted === true)
    for (const photo of toDelete) {
      try {
        await photoService.deletePhoto(photo.id)
        deleted.push(photo.id)
      } catch (error) {
        console.error(`Ошибка удаления фото ${photo.id}:`, error)
        throw error
      }
    }
    
    // 2. Загружаем новые фото (id === null && isDeleted === false && _raw?.max)
    const toUpload = photos.value.filter(p => p.id === null && !p.isDeleted && p._raw?.max)
    for (const photo of toUpload) {
      try {
        const saved = await photoService.uploadPhoto(objectId, photo._raw.max, photo._raw.min)
        uploaded.push(saved)
      } catch (error) {
        console.error('Ошибка загрузки фото:', error)
        throw error
      }
    }
    
    // 3. Обновляем локальный массив
    // Оставляем только фото, которые не помечены на удаление и имеют id (или новые которые загружены)
    const remaining = photos.value.filter(p => !(p.id !== null && p.isDeleted === true))
    
    // Заменяем новые фото на сохранённые (с реальными id)
    let uploadIndex = 0
    const updatedRemaining = []
    
    for (const p of remaining) {
      if (p.id === null && !p.isDeleted && uploadIndex < uploaded.length) {
        const saved = uploaded[uploadIndex++]
        // Освобождаем временные URL
        if (p.min?.startsWith('blob:')) URL.revokeObjectURL(p.min)
        if (p.max?.startsWith('blob:')) URL.revokeObjectURL(p.max)
        
        // Сохраняем как фото с сервера (с _photoObject)
        // Для загруженного фото saved.getUrl и saved.getThumbUrl — это методы
        updatedRemaining.push({
          id: saved.id,
          _photoObject: saved,
          min: null,        // будет загружено асинхронно при необходимости
          max: null,
          _loadingMin: false,
          isDeleted: false
        })
      } else {
        updatedRemaining.push(p)
      }
    }
    
    photos.value = updatedRemaining
    
    // Асинхронно загружаем миниатюры для новых загруженных фото
    for (const p of photos.value) {
      if (p._photoObject && !p.min && !p._loadingMin) {
        p._loadingMin = true
        try {
          p.min = await p._photoObject.getThumbUrl()
        } catch (error) {
          console.error(`Ошибка загрузки миниатюры для нового фото:`, error)
        } finally {
          p._loadingMin = false
        }
      }
    }
    
    return { uploaded, deleted }
  }

  // Очистка массива и освобождение памяти
  const cleanup = () => {
    photos.value.forEach(p => {
      // Освобождаем blob URL для новых фото
      if (p.min?.startsWith('blob:')) URL.revokeObjectURL(p.min)
      if (p.max?.startsWith('blob:')) URL.revokeObjectURL(p.max)
      // Вызываем revoke у photoObject (для фото с сервера)
      if (p._photoObject && typeof p._photoObject.revoke === 'function') {
        p._photoObject.revoke()
      }
    })
    photos.value = []
    isProcessing.value = false
    isLoading.value = false
    loadError.value = null
  }

  return {
    photos,
    isProcessing,
    isLoading,
    loadError,
    loadPhotos,
    getFullPhotoUrl,
    addPhoto,
    toggleDeleteMark,
    savePhotosChanges,
    cleanup
  }
}