/**
 * Сервис для работы с вложениями email
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим: все запросы к API
 * Офлайн-режим: все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

export class EmailAttachmentService {
  constructor() {
    this.baseUrl = '/api'
  }

  isFlightMode() {
    return localStorage.getItem('u40ta_flight_mode') === 'true'
  }

  //============================================================================
  // РАБОТА СО СПИСКОМ ВЛОЖЕНИЙ
  //============================================================================

  /**
   * Получает все вложения (онлайн/офлайн)
   * В онлайн-режиме также синхронизирует кэш
   * @returns {Promise<Array>} Массив вложений в camelCase
   */
  async getAllAttachments() {
    if (this.isFlightMode()) {
      console.log('[EmailAttachmentService] Офлайн: получение из кэша')
      return this.getFromCache()
    }
    
    console.log('[EmailAttachmentService] Онлайн: получение с сервера')
    const attachments = await this.getFromApi()
    
    return attachments
  }

  async getFromCache() {
    return await offlineCache.getAllEmailAttachments()
  }

  async getFromApi() {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const response = await fetch(`${this.baseUrl}/email/attachments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)

    return await response.json() // Уже в camelCase
  }

  //============================================================================
  // ОПЕРАЦИИ ТОЛЬКО ДЛЯ ОНЛАЙН-РЕЖИМА
  //============================================================================

  /**
   * Проверка почты (только онлайн)
   */
  async checkEmail() {
    if (this.isFlightMode()) {
      throw new Error('Проверка почты недоступна в офлайн-режиме')
    }

    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${this.baseUrl}/email/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)
    
    return await response.json()
  }

  /**
   * Удаление вложения (только онлайн)
   */
  async deleteAttachment(attachmentId) {
    if (this.isFlightMode()) {
      throw new Error('Удаление недоступно в офлайн-режиме')
    }

    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${this.baseUrl}/email/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`)
    
    const result = await response.json()
    
    return result
  }

  //============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  //============================================================================

  /**
   * Получает одно вложение по ID (для statement.service)
   */
  async getAttachmentById(id) {
    if (this.isFlightMode()) {
      // оффлайн-режим
      return await offlineCache.getEmailAttachment(id)
    }
    
    // В онлайн-режиме с сервера
    const attachments = await this.getFromApi()
    return attachments.find(a => a.id === id) || null
  }
}

export const emailAttachmentService = new EmailAttachmentService()