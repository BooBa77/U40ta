import { ref, reactive, watch } from 'vue'
import { objectService } from './services/ObjectService.js'

// Локальный кэш значений мест (пока без бэкенда)
const placesData = {
  ter: [],
  pos: {},
  cab: {},
  user: {}
}

// Функция для создания и управления состоянием формы
export function useObjectForm(route, router) {
  const id = route.params.id
  const isLoading = ref(false)
  const error = ref(null)
  const isSaving = ref(false)
  const saveSuccess = ref(false)

  // Данные с бэкенда
  const sklad = ref('')
  const inv_number = ref('')
  const party_number = ref('')
  const buh_name = ref('')
  const sn = ref('')
  const checked_at = ref('')

  // Значения мест
  const place_ter = ref('')
  const place_pos = ref('')
  const place_cab = ref('')
  const place_user = ref('')

  // Динамические опции для каждого уровня
  const placeOptions = reactive({
    ter: [],
    pos: [],
    cab: [],
    user: []
  })

  // Загрузка данных с бэкенда
  const loadObject = async () => {
    isLoading.value = true
    error.value = null
    try {
      const data = await objectService.fetchObject(id)

      // Заполняем основные поля
      sklad.value = data.sklad
      inv_number.value = data.inv_number
      party_number.value = data.party_number || ''
      buh_name.value = data.buh_name
      sn.value = data.sn || ''
      checked_at.value = data.checked_at || new Date().toISOString().split('T')[0]
      place_ter.value = data.place_ter || ''
      place_pos.value = data.place_pos || ''
      place_cab.value = data.place_cab || ''
      place_user.value = data.place_user || ''

      // Обновляем локальный кэш мест
      updatePlacesCache(data)

      // Инициализация опций
      updatePlaceOptions()
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки объекта'
      console.error('Ошибка загрузки объекта:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Обновляем кэш мест на основе загруженных данных
  const updatePlacesCache = (data) => {
    if (data.place_ter && !placesData.ter.includes(data.place_ter)) {
      placesData.ter.push(data.place_ter)
    }
    if (data.place_ter && data.place_pos) {
      if (!placesData.pos[data.place_ter]) {
        placesData.pos[data.place_ter] = []
      }
      if (!placesData.pos[data.place_ter].includes(data.place_pos)) {
        placesData.pos[data.place_ter].push(data.place_pos)
      }
    }
    if (data.place_pos && data.place_cab) {
      if (!placesData.cab[data.place_pos]) {
        placesData.cab[data.place_pos] = []
      }
      if (!placesData.cab[data.place_pos].includes(data.place_cab)) {
        placesData.cab[data.place_pos].push(data.place_cab)
      }
    }
    if (data.place_cab && data.place_user) {
      if (!placesData.user[data.place_cab]) {
        placesData.user[data.place_cab] = []
      }
      if (!placesData.user[data.place_cab].includes(data.place_user)) {
        placesData.user[data.place_cab].push(data.place_user)
      }
    }
  }

  // Обновление опций в зависимости от выбранных значений
  const updatePlaceOptions = () => {
    placeOptions.ter = placesData.ter

    if (place_ter.value && placesData.pos[place_ter.value]) {
      placeOptions.pos = placesData.pos[place_ter.value]
    } else {
      placeOptions.pos = []
    }

    if (place_pos.value && placesData.cab[place_pos.value]) {
      placeOptions.cab = placesData.cab[place_pos.value]
    } else {
      placeOptions.cab = []
    }

    if (place_cab.value && placesData.user[place_cab.value]) {
      placeOptions.user = placesData.user[place_cab.value]
    } else {
      placeOptions.user = []
    }
  }

  // Обработчики изменений
  const onTerChange = () => {
    place_pos.value = ''
    place_cab.value = ''
    place_user.value = ''
    updatePlaceOptions()
  }

  const onPosChange = () => {
    place_cab.value = ''
    place_user.value = ''
    updatePlaceOptions()
  }

  const onCabChange = () => {
    place_user.value = ''
    updatePlaceOptions()
  }

  // Сохранение нового значения в кэш
  const saveNewPlace = (level, parent, value) => {
    if (!value.trim()) return

    if (level === 'ter') {
      if (!placesData.ter.includes(value)) {
        placesData.ter.push(value)
      }
    } else if (level === 'pos' && parent) {
      if (!placesData.pos[parent]) {
        placesData.pos[parent] = []
      }
      if (!placesData.pos[parent].includes(value)) {
        placesData.pos[parent].push(value)
      }
    } else if (level === 'cab' && parent) {
      if (!placesData.cab[parent]) {
        placesData.cab[parent] = []
      }
      if (!placesData.cab[parent].includes(value)) {
        placesData.cab[parent].push(value)
      }
    } else if (level === 'user' && parent) {
      if (!placesData.user[parent]) {
        placesData.user[parent] = []
      }
      if (!placesData.user[parent].includes(value)) {
        placesData.user[parent].push(value)
      }
    }
    updatePlaceOptions()
  }

  // Сохранение изменений
  const saveObject = async () => {
    isSaving.value = true
    saveSuccess.value = false
    error.value = null
    
    try {
      const updateData = {
        sn: sn.value,
        checked_at: checked_at.value,
        place_ter: place_ter.value,
        place_pos: place_pos.value,
        place_cab: place_cab.value,
        place_user: place_user.value
      }
      
      await objectService.updateObject(id, updateData)
      
      saveSuccess.value = true
      setTimeout(() => {
        saveSuccess.value = false
      }, 3000)
      
    } catch (err) {
      error.value = err.message || 'Ошибка сохранения'
      console.error('Ошибка сохранения:', err)
    } finally {
      isSaving.value = false
    }
  }

  const goBack = () => {
    router.back()
  }

  // Следим за изменениями значений мест
  watch([place_ter, place_pos, place_cab], () => {
    updatePlaceOptions()
  })

  return {
    isLoading,
    error,
    isSaving,
    saveSuccess,
    sklad,
    inv_number,
    party_number,
    buh_name,
    sn,
    checked_at,
    place_ter,
    place_pos,
    place_cab,
    place_user,
    placeOptions,
    onTerChange,
    onPosChange,
    onCabChange,
    saveNewPlace,
    saveObject,
    goBack,
    loadObject
  }
}