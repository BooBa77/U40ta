/**
 * Сервис для работы с историей изменений объектов
 */
class HistoryService {
  constructor() {
    this.baseUrl = '/api/history'
  }

  /**
   * Получает историю изменений объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Object[]>} Массив записей истории
   */
  async getObjectHistory(objectId) {
    console.log(`[HistoryService] Получение истории объекта ${objectId}`)
    
    // TODO: Реальный API-запрос
    // Временные данные
    return [
      {
        id: 1,
        object_id: objectId,
        user_id: 101,
        user_name: 'Иванов И.И.',
        action: 'Создание объекта',
        comment: 'Объект создан при сканировании QR-кода',
        created_at: '2024-01-10T09:15:00Z'
      },
      {
        id: 2,
        object_id: objectId,
        user_id: 101,
        user_name: 'Иванов И.И.',
        action: 'Изменён серийный номер',
        comment: 'SN изменён с "OLD123" на "NEW456"',
        created_at: '2024-01-15T14:30:00Z'
      },
      {
        id: 3,
        object_id: objectId,
        user_id: 102,
        user_name: 'Петров П.П.',
        action: 'Изменено местоположение',
        comment: 'Перенесён в кабинет 101',
        created_at: '2024-01-20T11:20:00Z'
      }
    ]
  }

  /**
   * Добавляет запись в историю
   * @param {Object} record - Данные записи
   * @returns {Promise<Object>} Созданная запись
   */
  async addHistoryRecord(record) {
    console.log('[HistoryService] Добавление записи в историю:', record)
    
    // TODO: Реальный API-запрос
    await this._simulateDelay()
    
    return {
      id: Date.now(),
      ...record,
      created_at: new Date().toISOString()
    }
  }

  /**
   * Имитация задержки сети
   */
  async _simulateDelay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const historyService = new HistoryService()