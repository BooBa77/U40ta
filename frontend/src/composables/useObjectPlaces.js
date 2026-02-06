/**
 * Композабл для работы с иерархией местоположения объектов
 * Территория → Помещение → Кабинет → Пользователь
 * Переиспользуется в ObjectFormModal и фильтрах поиска
 */
import { ref, watch } from 'vue'
import { placesService } from '@/services/PlacesService.js'

export function useObjectPlaces(initialObject = null) {
  // Текущие значения
  const territory = ref(initialObject?.place_ter || '')
  const room = ref(initialObject?.place_pos || '')
  const cabinet = ref(initialObject?.place_cab || '')
  const user = ref(initialObject?.place_user || '')
  
  // Опции для выпадающих списков
  const territoryOptions = ref([])
  const roomOptions = ref([])
  const cabinetOptions = ref([])
  const userOptions = ref([])
  
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Загружает опции для территорий
   */
  const loadTerritories = async () => {
    isLoading.value = true
    try {
      // TODO: Заменить на реальный API-вызов
      territoryOptions.value = await placesService.getTerritories()
    } catch (err) {
      error.value = `Ошибка загрузки территорий: ${err.message}`
      console.error('Ошибка загрузки территорий:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Загружает опции для помещений на выбранной территории
   */
  const loadRooms = async () => {
    if (!territory.value) {
      roomOptions.value = []
      return
    }
    
    isLoading.value = true
    try {
      // TODO: Заменить на реальный API-вызов
      roomOptions.value = await placesService.getRooms(territory.value)
    } catch (err) {
      error.value = `Ошибка загрузки помещений: ${err.message}`
      console.error('Ошибка загрузки помещений:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Загружает опции для кабинетов в выбранном помещении
   */
  const loadCabinets = async () => {
    if (!room.value) {
      cabinetOptions.value = []
      return
    }
    
    isLoading.value = true
    try {
      // TODO: Заменить на реальный API-вызов
      cabinetOptions.value = await placesService.getCabinets(room.value)
    } catch (err) {
      error.value = `Ошибка загрузки кабинетов: ${err.message}`
      console.error('Ошибка загрузки кабинетов:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Загружает опции для пользователей в выбранном кабинете
   */
  const loadUsers = async () => {
    if (!cabinet.value) {
      userOptions.value = []
      return
    }
    
    isLoading.value = true
    try {
      // TODO: Заменить на реальный API-вызов
      userOptions.value = await placesService.getUsers(cabinet.value)
    } catch (err) {
      error.value = `Ошибка загрузки пользователей: ${err.message}`
      console.error('Ошибка загрузки пользователей:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Сохраняет новое значение места в кэш/БД
   */
  const saveNewPlace = async (level, parentValue, newValue) => {
    if (!newValue?.trim()) return
    
    try {
      await placesService.savePlace(level, parentValue, newValue)
      
      // Обновляем локальные опции
      switch (level) {
        case 'territory':
          if (!territoryOptions.value.includes(newValue)) {
            territoryOptions.value.push(newValue)
          }
          break
        case 'room':
          if (!roomOptions.value.includes(newValue)) {
            roomOptions.value.push(newValue)
          }
          break
        case 'cabinet':
          if (!cabinetOptions.value.includes(newValue)) {
            cabinetOptions.value.push(newValue)
          }
          break
        case 'user':
          if (!userOptions.value.includes(newValue)) {
            userOptions.value.push(newValue)
          }
          break
      }
    } catch (err) {
      console.error('Ошибка сохранения места:', err)
    }
  }

  // Реактивные обновления при изменении значений
  watch(territory, (newTerritory) => {
    if (newTerritory) {
      room.value = ''
      cabinet.value = ''
      user.value = ''
      loadRooms()
    } else {
      roomOptions.value = []
      cabinetOptions.value = []
      userOptions.value = []
    }
  })

  watch(room, (newRoom) => {
    if (newRoom) {
      cabinet.value = ''
      user.value = ''
      loadCabinets()
    } else {
      cabinetOptions.value = []
      userOptions.value = []
    }
  })

  watch(cabinet, (newCabinet) => {
    if (newCabinet) {
      user.value = ''
      loadUsers()
    } else {
      userOptions.value = []
    }
  })

  // Инициализация
  loadTerritories()

  return {
    // Значения
    territory,
    room,
    cabinet,
    user,
    
    // Опции
    territoryOptions,
    roomOptions,
    cabinetOptions,
    userOptions,
    
    // Состояние
    isLoading,
    error,
    
    // Методы
    loadTerritories,
    loadRooms,
    loadCabinets,
    loadUsers,
    saveNewPlace
  }
}