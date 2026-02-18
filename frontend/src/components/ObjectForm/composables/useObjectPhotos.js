import { ref } from 'vue'

export function useObjectPhotos() {
  const photos = ref([])

  const loadPhotos = async (objectId) => {
    console.log('Заглушка: загрузка фото', objectId)
  }

  const addPhoto = async (objectId) => {
    console.log('Заглушка: добавление фото', objectId)
  }

  const removePhoto = (index) => {
    photos.value.splice(index, 1)
  }

  return {
    photos,
    loadPhotos,
    addPhoto,
    removePhoto
  }
}