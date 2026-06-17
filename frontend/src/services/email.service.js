/**
 * Сервис для работы с почтовым ящиком.
 * Проверка новых писем через API.
 */
export class EmailService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Проверяет, активен ли режим полёта
   * @returns {boolean}
   */
  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  /**
   * Запускает проверку почтового ящика.
   * Только онлайн.
   * POST /api/email/check
   * @returns {Promise<Object>} { success, message }
   */
  async checkEmail() {
    if (this.isFlightMode()) {
      throw new Error('Проверка почты недоступна в офлайн-режиме')
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    try {
      const response = await fetch(`${this.baseUrl}/email/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[EmailService] Ошибка проверки почты:', error)
      throw error
    }
  }
}

export const emailService = new EmailService()