/**
 * Сервис для работы с инвентаризационными ведомостями ревизора.
 * Все запросы только онлайн (офлайн-режим не поддерживается).
 */
export class InventoryService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Универсальный метод для запросов к API.
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
  // BATCH'И (склады из инвентаризационных ведомостей)
  //============================================================================

  /**
   * Получить список уникальных batch'ей ревизора.
   * Каждый batch = группа строк из одного Excel-файла.
   * 
   * GET /api/inventory/batches
   * 
   * @returns {Promise<Array>} Массив batch'ей: { emailFrom, receivedAt, zavod, sklad, docType, count }
   */
  async getBatches() {
    console.log('[InventoryService] Получение списка batch\'ей')
    return await this.apiRequest('/inventory/batches')
  }

  /**
   * Получить все строки конкретного batch'а.
   * 
   * GET /api/inventory/batches/items
   * 
   * @param {string} emailFrom - email ревизора
   * @param {string} receivedAt - дата получения (ISO строка)
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Array>} Массив строк InventoryStatement
   */
  async getBatchItems(emailFrom, receivedAt, zavod, sklad) {
    console.log(`[InventoryService] Получение строк batch\'а: zavod=${zavod}, sklad=${sklad}`)
    
    const params = new URLSearchParams({
      emailFrom,
      receivedAt,
      zavod: String(zavod),
      sklad
    })
    
    return await this.apiRequest(`/inventory/batches/items?${params.toString()}`)
  }

  /**
   * Удалить batch (все строки конкретной комбинации).
   * 
   * DELETE /api/inventory/batches
   * 
   * @param {string} emailFrom - email ревизора
   * @param {string} receivedAt - дата получения (ISO строка)
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Object>} { success: true, message: 'Пакет удалён' }
   */
  async deleteBatch(emailFrom, receivedAt, zavod, sklad) {
    console.log(`[InventoryService] Удаление batch\'а: zavod=${zavod}, sklad=${sklad}`)
    
    const params = new URLSearchParams({
      emailFrom,
      receivedAt,
      zavod: String(zavod),
      sklad
    })
    
    return await this.apiRequest(`/inventory/batches?${params.toString()}`, {
      method: 'DELETE'
    })
  }
}

// Экспортируем синглтон
export const inventoryService = new InventoryService()