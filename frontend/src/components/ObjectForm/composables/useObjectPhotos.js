import { ref } from 'vue'
import { photoService } from '@/services/photo-service.js'

export function useObjectPhotos() {
  const photos = ref([])
  const isProcessing = ref(false)
  const isLoading = ref(false)
  const loadError = ref(null)

  // Функция создания миниатюры
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

  // Функция загрузки фотографий
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
      })
      
      photos.value = serverPhotos.map(photo => ({
        id: photo.id,
        min: photo.thumbUrl,
        max: photo.url,
        _raw: null,
        isDeleted: false
      }))
      
    } catch (error) {
      loadError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  // Добавление фотографии с камеры
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
    // Новые фото (id === null) тоже можно помечать на удаление
    photo.isDeleted = !photo.isDeleted
  }

  // Сохранение изменений
  const savePhotosChanges = async (objectId) => {
    if (!objectId) return { uploaded: [], deleted: [] }
    
    const uploaded = []
    const deleted = []
    
    // 1. Удаляем помеченные фото (включая новые, но новые просто не сохранятся)
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
    
    // 2. Загружаем новые фото (id === null && isDeleted === false)
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
    
    // 3. Обновляем локальный массив: удаляем помеченные, заменяем новые на сохранённые
    // Оставляем только фото, которые не помечены на удаление и имеют id
    const remaining = photos.value.filter(p => !(p.id !== null && p.isDeleted === true))
    
    // Заменяем новые фото на сохранённые (с реальными id)
    let uploadIndex = 0
    const updatedRemaining = remaining.map(p => {
      if (p.id === null && !p.isDeleted && uploadIndex < uploaded.length) {
        const saved = uploaded[uploadIndex++]
        // Освобождаем временные URL
        if (p.min?.startsWith('blob:')) URL.revokeObjectURL(p.min)
        if (p.max?.startsWith('blob:')) URL.revokeObjectURL(p.max)
        return {
          id: saved.id,
          min: saved.thumbUrl,
          max: saved.url,
          _raw: null,
          isDeleted: false
        }
      }
      return p
    })
    
    photos.value = updatedRemaining
    
    return { uploaded, deleted }
  }

  // Очистка массива
  const cleanup = () => {
    photos.value.forEach(p => {
      if (p.min?.startsWith('blob:')) URL.revokeObjectURL(p.min)
      if (p.max?.startsWith('blob:')) URL.revokeObjectURL(p.max)
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
    addPhoto,
    toggleDeleteMark,
    savePhotosChanges,
    cleanup
  }
}