import { ref } from 'vue'
import { objectService } from '@/services/object-service'

export function useObjectFormLifecycle(props, emit) {
  // Состояния
  const isSaving = ref(false)
  const errorMessage = ref('')
  const comment = ref('')
  
  // Данные объекта
  const objectData = ref({
    id: null,
    inv_number: '',
    buh_name: '',
    sklad: '',
    zavod: '',
    party_number: '',
    sn: ''
  })

  // Загрузка существующего объекта
  const loadObject = async (id) => {
    errorMessage.value = ''
    
    try {
      const object = await objectService.getObject(id)
      
      objectData.value = {
        id: object.id,
        inv_number: object.inv_number || '',
        buh_name: object.buh_name || '',
        sklad: object.sklad || '',
        zavod: object.zavod || '',
        party_number: object.party_number || '',
        sn: object.sn || ''
      }
      
      // Возвращаем объект для инициализации других композаблов
      return object
      
    } catch (error) {
      errorMessage.value = `Ошибка загрузки: ${error.message}`
      console.error('Ошибка загрузки объекта:', error)
      throw error
    }
  }

  // Инициализация данными из строки ведомости (для нового объекта)
  const initFromRowData = (initialData) => {
    objectData.value = {
      id: null,
      inv_number: initialData.inv_number || '',
      buh_name: initialData.buh_name || '',
      sklad: initialData.sklad || '',
      zavod: initialData.zavod || '',
      party_number: initialData.party_number || '',
      sn: initialData.sn || ''
    }
    
    return {
      place_ter: initialData.place_ter || '',
      place_pos: initialData.place_pos || '',
      place_cab: initialData.place_cab || '',
      place_user: initialData.place_user || ''
    }
  }

  // Полный сброс формы
  const resetForm = () => {
    objectData.value = {
      id: null,
      inv_number: '',
      buh_name: '',
      sklad: '',
      zavod: '',
      party_number: '',
      sn: ''
    }
    comment.value = ''
    errorMessage.value = ''
    isSaving.value = false
  }

  // Подготовка данных для сохранения
  const prepareSaveData = (additionalData = {}) => {
    return {
      id: objectData.value.id,
      inv_number: objectData.value.inv_number,
      buh_name: objectData.value.buh_name,
      sklad: objectData.value.sklad,
      zavod: objectData.value.zavod,
      party_number: objectData.value.party_number || null,
      sn: objectData.value.sn || null,
      ...additionalData  // места, etc
    }
  }

  return {
    // Состояния
    isSaving,
    errorMessage,
    comment,
    objectData,
    
    // Методы
    loadObject,
    initFromRowData,
    resetForm,
    prepareSaveData,
    
    // Вспомогательные (прямой доступ)
    setSaving: (value) => isSaving.value = value,
    setError: (message) => errorMessage.value = message
  }
}