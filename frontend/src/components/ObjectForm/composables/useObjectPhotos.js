/**
 * Composable для управления фотографиями объекта
 * 
 * Отвечает за:
 * - Загрузку фото с сервера/из кэша через photoService
 * - Добавление новых фото с камеры (создание квадратных миниатюр 150x150 и 800x800)
 * - Пометку фото на удаление
 * - Подготовку данных для комбинированного сохранения (prepareForSave)
 * - Освобождение ресурсов (ObjectURL)
 * 
 * Для каждого фото предоставляет единый интерфейс getFullUrl() 
 * для получения полноразмерного изображения (скрывает детали реализации)
 */

import { ref } from 'vue'
import { photoService } from '@/services/photo-service.js'

/**
 * Создаёт квадратную версию изображения (cover-эффект)
 * @param {Blob} blob - исходный Blob изображения
 * @param {number} size - целевой размер (ширина = высота)
 * @returns {Promise<Blob>} Blob квадратного изображения в формате JPEG
 */
async function createSquareImage(blob, size) {
  return new Promise((resolve, reject) => {
    if (!blob || !(blob instanceof Blob) || blob.size === 0) {
      reject(new Error('Некорректные данные изображения'))
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      
      // Вычисляем масштаб и отступы для cover-эффекта
      const scale = Math.max(size / img.width, size / img.height)
      const x = (size - img.width * scale) / 2
      const y = (size - img.height * scale) / 2

      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)

      canvas.toBlob((thumbnailBlob) => {
        resolve(thumbnailBlob)
      }, 'image/jpeg', 0.9)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Ошибка загрузки изображения'))
    }

    img.src = url
  })
}

/**
 * Конвертирует Blob в base64 строку
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function useObjectPhotos() {
  const photos = ref([])
  const isLoading = ref(false)
  const loadError = ref(null)

  /**
   * Загружает фотографии объекта с сервера или из кэша
   * @param {number} objectId - ID объекта
   */
  const loadPhotos = async (objectId) => {
    if (!objectId) return

    isLoading.value = true
    loadError.value = null

    try {
      const serverPhotos = await photoService.getObjectPhotos(objectId)

      // Освобождаем старые ресурсы
      resetPhotos()

      // Создаём массив с единым интерфейсом
      const loadedPhotos = []

      for (const serverPhoto of serverPhotos) {
        // Сразу получаем миниатюру для отображения
        let minUrl = null
        try {
          minUrl = await serverPhoto.getThumbUrl()
        } catch (err) {
          console.error(`Ошибка загрузки миниатюры для фото ${serverPhoto.id}:`, err)
          continue
        }

        let revokeFn = null
        let maxUrl = null

        loadedPhotos.push({
          id: serverPhoto.id,
          minUrl: minUrl,
          isDeleted: false,

          // Единый метод получения полноразмерного фото
          getFullUrl: async () => {
            if (maxUrl) return maxUrl

            try {
              const url = await serverPhoto.getUrl()
              maxUrl = url
              return url
            } catch (err) {
              console.error(`Ошибка загрузки полноразмерного фото ${serverPhoto.id}:`, err)
              throw err
            }
          },

          // Внутренние данные
          _source: 'server',
          _photoObject: serverPhoto,
          _maxBlob: null,
          _maxUrl: null,
          _revokeFn: () => {
            if (revokeFn) revokeFn()
            if (maxUrl && maxUrl.startsWith('blob:')) {
              URL.revokeObjectURL(maxUrl)
              maxUrl = null
            }
          }
        })
      }

      photos.value = loadedPhotos
    } catch (error) {
      loadError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Добавляет новое фото с камеры
   * @param {Blob} blob - исходный Blob с камеры
   */
  const addPhoto = async (blob) => {
    try {
      // Создаём квадратные версии
      const [minBlob, maxBlob] = await Promise.all([
        createSquareImage(blob, 150),
        createSquareImage(blob, 800)
      ])

      // Создаём ObjectURL для миниатюры (сразу для отображения)
      const minUrl = URL.createObjectURL(minBlob)

      let maxUrl = null

      const newPhoto = {
        id: null,
        minUrl: minUrl,
        isDeleted: false,

        getFullUrl: async () => {
          if (maxUrl) return maxUrl
          maxUrl = URL.createObjectURL(maxBlob)
          return maxUrl
        },

        _source: 'new',
        _photoObject: null,
        _maxBlob: maxBlob,
        _maxUrl: null,
        _revokeFn: () => {
          if (minUrl && minUrl.startsWith('blob:')) {
            URL.revokeObjectURL(minUrl)
          }
          if (maxUrl && maxUrl.startsWith('blob:')) {
            URL.revokeObjectURL(maxUrl)
            maxUrl = null
          }
        }
      }

      photos.value.push(newPhoto)
    } catch (error) {
      console.error('Ошибка при добавлении фото:', error)
      throw error
    }
  }

  /**
   * Переключает пометку на удаление у фото по индексу
   * @param {number} index
   */
  const toggleDeleteMark = (index) => {
    if (index < 0 || index >= photos.value.length) return
    photos.value[index].isDeleted = !photos.value[index].isDeleted
  }

  /**
   * Подготавливает данные для комбинированного сохранения
   * @returns {{ toAdd: Array<{max: string, min: string}>, toDelete: Array<number> }}
   */
  const prepareForSave = async () => {
    const toAdd = []
    const toDelete = []

    for (const photo of photos.value) {
      // Новое фото, не помеченное на удаление
      if (photo.id === null && !photo.isDeleted && photo._source === 'new') {
        const maxBase64 = await blobToBase64(photo._maxBlob)
        // Для миниатюры нужно получить Blob из ObjectURL
        // Загружаем изображение из minUrl, чтобы получить Blob
        const minResponse = await fetch(photo.minUrl)
        const minBlob = await minResponse.blob()
        const minBase64 = await blobToBase64(minBlob)
        
        toAdd.push({
          max: maxBase64,
          min: minBase64
        })
      }
      
      // Существующее фото, помеченное на удаление
      if (photo.id !== null && photo.isDeleted === true) {
        toDelete.push(photo.id)
      }
    }

    return { toAdd, toDelete }
  }

  /**
   * Освобождает все ресурсы (ObjectURL) и очищает массив
   */
  const resetPhotos = () => {
    for (const photo of photos.value) {
      if (photo._revokeFn) {
        photo._revokeFn()
      }
    }
    photos.value = []
    isLoading.value = false
    loadError.value = null
  }

  return {
    photos,
    isLoading,
    loadError,
    loadPhotos,
    addPhoto,
    toggleDeleteMark,
    prepareForSave,
    resetPhotos
  }
}