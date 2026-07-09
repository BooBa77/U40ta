/**
 * Сервис для работы с МОЛ (материально-ответственные лица)
 * Поддерживает онлайн/офлайн режимы работы
 */
export class MolService {
  constructor() {
    this.baseUrl = '/api'
  }

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

  // ============================================================================
  // ЭКСПОРТ В EXCEL
  // ============================================================================

  /**
   * Выгрузить доступные объекты МОЛа в Excel и отправить на почту текущему пользователю.
   * Только онлайн.
   * 
   * POST /api/mol/export-excel
   * 
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async exportObjectsToExcel() {
    if (this.isFlightMode()) {
      throw new Error('Выгрузка в Excel недоступна в офлайн-режиме')
    }

    try {
      const data = await this.apiRequest('/mol/export-excel', {
        method: 'POST'
      })
      return data
    } catch (error) {
      console.error('[MolService] Ошибка выгрузки в Excel:', error)
      throw error
    }
  }
}

// Экспортируем синглтон
export const molService = new MolService()