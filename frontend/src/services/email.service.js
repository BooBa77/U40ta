/**
 * Сервис для работы с почтой и email-авторизацией.
 * Включает проверку новых писем и авторизацию по email с подтверждением кода.
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

  // ========== Методы для email-авторизации ==========

  /**
   * Отправить код подтверждения на email.
   * 
   * POST /api/auth/email/send-code
   * 
   * @param {string} email - email пользователя
   * @returns {Promise<{ success: boolean; message: string }>}
   */
  async sendCode(email) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/email/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Ошибка отправки кода')
      }

      return await response.json()
    } catch (error) {
      console.error('[EmailService] Ошибка отправки кода:', error)
      throw error
    }
  }

  /**
   * Проверить код и получить JWT токен.
   * 
   * POST /api/auth/email/verify
   * 
   * @param {string} email - email пользователя
   * @param {string} code - код подтверждения
   * @returns {Promise<{ access_token: string }>}
   */
  async verifyCode(email, code) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Неверный код подтверждения')
      }

      return await response.json()
    } catch (error) {
      console.error('[EmailService] Ошибка проверки кода:', error)
      throw error
    }
  }

  /**
   * Проверить статус кода для email.
   * Используется для восстановления состояния после F5.
   * 
   * POST /api/auth/email/check-status
   * 
   * @param {string} email - email пользователя
   * @returns {Promise<{ hasActiveCode: boolean; remainingSeconds: number }>}
   */
  async checkCodeStatus(email) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/email/check-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        throw new Error('Ошибка проверки статуса кода')
      }

      return await response.json()
    } catch (error) {
      console.error('[EmailService] Ошибка проверки статуса:', error)
      throw error
    }
  }
}

export const emailService = new EmailService()