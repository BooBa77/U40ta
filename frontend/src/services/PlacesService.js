/**
 * Сервис для работы с иерархией местоположения
 * Территория → Помещение → Кабинет → Пользователь
 */
class PlacesService {
  constructor() {
    this.baseUrl = '/api/places'
  }

  /**
   * Получает список территорий
   * @returns {Promise<string[]>} Массив названий территорий
   */
  async getTerritories() {
    console.log('[PlacesService] Получение списка территорий')
    
    // TODO: Реальный API-запрос
    // Временные данные
    return ['Главный корпус', 'Второй корпус', 'Складская зона']
  }

  /**
   * Получает список помещений на территории
   * @param {string} territory - Название территории
   * @returns {Promise<string[]>} Массив названий помещений
   */
  async getRooms(territory) {
    console.log(`[PlacesService] Получение помещений для территории: ${territory}`)
    
    // TODO: Реальный API-запрос
    // Временные данные
    const roomsByTerritory = {
      'Главный корпус': ['Цех №1', 'Цех №2', 'Администрация'],
      'Второй корпус': ['Лаборатория', 'Серверная'],
      'Складская зона': ['Склад №1', 'Склад №2']
    }
    
    return roomsByTerritory[territory] || []
  }

  /**
   * Получает список кабинетов в помещении
   * @param {string} room - Название помещения
   * @returns {Promise<string[]>} Массив номеров/названий кабинетов
   */
  async getCabinets(room) {
    console.log(`[PlacesService] Получение кабинетов для помещения: ${room}`)
    
    // TODO: Реальный API-запрос
    // Временные данные
    const cabinetsByRoom = {
      'Администрация': ['Кабинет 101', 'Кабинет 102', 'Кабинет 103'],
      'Лаборатория': ['Лаб. 201', 'Лаб. 202'],
      'Серверная': ['Серверная 301']
    }
    
    return cabinetsByRoom[room] || []
  }

  /**
   * Получает список пользователей в кабинете
   * @param {string} cabinet - Название кабинета
   * @returns {Promise<string[]>} Массив ФИО пользователей
   */
  async getUsers(cabinet) {
    console.log(`[PlacesService] Получение пользователей для кабинета: ${cabinet}`)
    
    // TODO: Реальный API-запрос
    // Временные данные
    const usersByCabinet = {
      'Кабинет 101': ['Иванов Иван Иванович', 'Петров Петр Петрович'],
      'Кабинет 102': ['Сидорова Мария Сергеевна'],
      'Лаб. 201': ['Кузнецов Алексей Владимирович']
    }
    
    return usersByCabinet[cabinet] || []
  }

  /**
   * Сохраняет новое значение места в системе
   * @param {string} level - Уровень (territory, room, cabinet, user)
   * @param {string} parentValue - Значение родительского уровня
   * @param {string} newValue - Новое значение
   * @returns {Promise<boolean>} true если успешно
   */
  async savePlace(level, parentValue, newValue) {
    console.log(`[PlacesService] Сохранение места: ${level}, родитель: ${parentValue}, значение: ${newValue}`)
    
    // TODO: Реальный API-запрос
    await this._simulateDelay()
    
    return true
  }

  /**
   * Имитация задержки сети
   */
  async _simulateDelay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const placesService = new PlacesService()