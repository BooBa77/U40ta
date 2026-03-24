// useObjectPlaces.js
import { ref, computed, watch } from 'vue'
import { objectService } from '@/services/object-service'

export function useObjectPlaces() {
  // Значения полей
  const territory = ref('')
  const position = ref('')      // позиция, здание (place_pos)
  const cabinet = ref('')       // кабинет (place_cab)
  const user = ref('')          // пользователь (place_user)

  // Все комбинации, загруженные с сервера
  const allCombinations = ref([])
  const isLoading = ref(false)
  const error = ref('')

  // Вычисляемые списки вариантов
  const territoryOptions = computed(() => {
    const unique = new Set(allCombinations.value.map(c => c.ter).filter(Boolean))
    return Array.from(unique).sort()
  })

  const positionOptions = computed(() => {
    if (!territory.value) return []
    const unique = new Set(
      allCombinations.value
        .filter(c => c.ter === territory.value && c.pos)
        .map(c => c.pos)
    )
    return Array.from(unique).sort()
  })

  const cabinetOptions = computed(() => {
    if (!territory.value || !position.value) return []
    const unique = new Set(
      allCombinations.value
        .filter(c => c.ter === territory.value && c.pos === position.value && c.cab)
        .map(c => c.cab)
    )
    return Array.from(unique).sort()
  })

  const userOptions = computed(() => {
    if (!territory.value || !position.value || !cabinet.value) return []
    const unique = new Set(
      allCombinations.value
        .filter(c => 
          c.ter === territory.value && 
          c.pos === position.value && 
          c.cab === cabinet.value && 
          c.user
        )
        .map(c => c.user)
    )
    return Array.from(unique).sort()
  })

  // Состояния доступности полей
  const isPositionEnabled = computed(() => territory.value.length > 0)
  const isCabinetEnabled = computed(() => position.value.length > 0)
  const isUserEnabled = computed(() => cabinet.value.length > 0)

  // Загрузка всех комбинаций с сервера
  const loadPlaceCombinations = async () => {
    isLoading.value = true
    error.value = ''
    
    try {
      allCombinations.value = await objectService.getPlaceCombinations()
    } catch (err) {
      error.value = `Ошибка загрузки местоположений: ${err.message}`
      console.error(err)
      allCombinations.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Проверка, существует ли значение в списке вариантов
  const existsInOptions = (value, options) => {
    return options.value.includes(value)
  }

  // Сброс всех полей
  const resetPlaces = () => {
    territory.value = ''
    position.value = ''
    cabinet.value = ''
    user.value = ''
  }

  const setPlacesFromObject = (object) => {
    console.log('[setPlacesFromObject] Весь объект:', object)
    console.log('[setPlacesFromObject] Поля с place_:', {
      place_ter: object.place_ter,
      place_pos: object.place_pos,
      place_cab: object.place_cab,
      place_user: object.place_user
    })
    console.log('[setPlacesFromObject] Поля без place_:', {
      ter: object.ter,
      pos: object.pos,
      cab: object.cab,
      user: object.user
    })

    territory.value = object.place_ter || object.ter || ''
    position.value = object.place_pos || object.pos || ''
    cabinet.value = object.place_cab || object.cab || ''
    user.value = object.place_user || object.user || ''

    console.log('[setPlacesFromObject] После установки:', {
      territory: territory.value,
      position: position.value,
      cabinet: cabinet.value,
      user: user.value
    })
  }

  // Получение объекта для сохранения
  const getPlacesForSave = () => {
    return {
      place_ter: territory.value,
      place_pos: position.value,
      place_cab: cabinet.value,
      place_user: user.value
    }
  }

  // Обработчики изменений с логикой сброса
  const handleTerritoryChange = (newValue) => {
    if (!existsInOptions(newValue, territoryOptions)) {
      // Ручной ввод нового значения - ничего не сбрасываем
      return
    }
    
    // Выбрано существующее значение - сбрасываем нижестоящие
    if (newValue !== territory.value) {
      position.value = ''
      cabinet.value = ''
      user.value = ''
    }
  }

  const handlePositionChange = (newValue) => {
    if (!existsInOptions(newValue, positionOptions)) {
      return
    }
    
    if (newValue !== position.value) {
      cabinet.value = ''
      user.value = ''
    }
  }

  const handleCabinetChange = (newValue) => {
    if (!existsInOptions(newValue, cabinetOptions)) {
      return
    }
    
    if (newValue !== cabinet.value) {
      user.value = ''
    }
  }

  // Watcher'ы для применения логики при изменениях через v-model
  watch(territory, (newVal) => {
    handleTerritoryChange(newVal)
  })

  watch(position, (newVal) => {
    handlePositionChange(newVal)
  })

  watch(cabinet, (newVal) => {
    handleCabinetChange(newVal)
  })

  return {
    // Значения
    territory,
    position,
    cabinet,
    user,
    
    // Списки вариантов
    territoryOptions,
    positionOptions,
    cabinetOptions,
    userOptions,
    
    // Состояния доступности
    isPositionEnabled,
    isCabinetEnabled,
    isUserEnabled,
    
    // Состояние загрузки
    isLoading,
    error,
    
    // Методы
    loadPlaceCombinations,
    resetPlaces,
    setPlacesFromObject,
    getPlacesForSave
  }
}