/**
 * Сервис для работы с инвентаризационными ведомостями (batch'ами ревизора)
 * Только онлайн-режим — в офлайне создание и редактирование книг недоступно
 * 
 * Используется в InventoryModal.vue при формировании новой книги
 * для выбора batch'ей и их строк.
 */
export class InventoryStatementsService {
  constructor() {
    this.baseUrl = '/api'
  }

  //============================================================================
  // БАЗОВЫЕ МЕТОДЫ
  //============================================================================

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean} true если режим полёта включен
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Универсальный метод для запросов к API
   * @param {string} endpoint - API endpoint (без /api/)
   * @param {Object} options - Параметры запроса
   * @returns {Promise<any>} Ответ от сервера
   */
  async apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    const defaultOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    }

    if (requestOptions.body && typeof requestOptions.body !== 'string') {
      requestOptions.body = JSON.stringify(requestOptions.body)
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions)

    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`)
    }

    return await response.json()
  }

  //============================================================================
  // ПОЛУЧЕНИЕ СПИСКА BATCH'ЕЙ
  //============================================================================

  /**
   * Получает список уникальных batch'ей ревизора.
   * Каждый batch — группа строк из одного Excel-файла.
   * Только онлайн.
   * 
   * @returns {Promise<Array>} Массив batch'ей с полями:
   *   emailFrom, receivedAt, zavod, sklad, docType, count
   */
  async getBatches() {
    if (this.isFlightMode()) {
      throw new Error('Получение инвентаризационных ведомостей недоступно в офлайн-режиме')
    }

    try {
      const data = await this.apiRequest('/inventory/batches')
      return data
    } catch (error) {
      console.error('[InventoryStatementsService] Ошибка получения batch\'ей:', error)
      throw error
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ СТРОК BATCH'А
  //============================================================================

  /**
   * Получает все строки конкретного batch'а.
   * Только онлайн.
   * 
   * @param {string} emailFrom - email ревизора
   * @param {string} receivedAt - дата получения batch'а (ISO строка)
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Array>} Массив строк InventoryStatement
   */
  async getBatchItems(emailFrom, receivedAt, zavod, sklad) {
    if (this.isFlightMode()) {
      throw new Error('Получение строк ведомости недоступно в офлайн-режиме')
    }

    try {
      const params = new URLSearchParams({
        emailFrom,
        receivedAt,
        zavod: String(zavod),
        sklad
      })

      const data = await this.apiRequest(`/inventory/batches/items?${params.toString()}`)
      return data
    } catch (error) {
      console.error('[InventoryStatementsService] Ошибка получения строк batch\'а:', error)
      throw error
    }
  }

  //============================================================================
  // УДАЛЕНИЕ BATCH'А
  //============================================================================

  /**
   * Удаляет все строки конкретного batch'а.
   * Только онлайн.
   * 
   * @param {string} emailFrom - email ревизора
   * @param {string} receivedAt - дата получения (ISO строка)
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteBatch(emailFrom, receivedAt, zavod, sklad) {
    if (this.isFlightMode()) {
      throw new Error('Удаление ведомости недоступно в офлайн-режиме')
    }

    try {
      const params = new URLSearchParams({
        emailFrom,
        receivedAt,
        zavod: String(zavod),
        sklad
      })

      const data = await this.apiRequest(`/inventory/batches?${params.toString()}`, {
        method: 'DELETE'
      })
      return data
    } catch (error) {
      console.error('[InventoryStatementsService] Ошибка удаления batch\'а:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const inventoryStatementsService = new InventoryStatementsService()