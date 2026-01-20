/**
 * Сервис для работы с ведомостями (statements)
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from '../../../services/OfflineCacheService'

export class StatementService {
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
   * Получает ведомость по ID вложения email
   * В онлайн-режиме: запрос к API
   * В офлайн-режиме: получение из кэша IndexedDB
   * @param {string|number} emailAttachmentId - ID вложения email
   * @returns {Promise<Array>} Массив объектов ведомости
   * @throws {Error} Ошибка загрузки данных
   */
  async fetchStatement(emailAttachmentId) {
    const attachmentId = Number(emailAttachmentId) // Приводим к числу
    
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: получение ведомости ${attachmentId} из кэша`)
      return this.getFromCache(attachmentId)
    }
    
    console.log(`[StatementService] Онлайн-режим: получение ведомости ${attachmentId} с сервера`)
    return this.getFromApi(attachmentId)
  }

  /**
   * Получает ведомость из кэша IndexedDB
   * ВНИМАНИЕ: Поля в IndexedDB могут быть в разных форматах:
   * - snake_case (email_attachment_id) - если данные были преобразованы
   * - camelCase (emailAttachmentId) - если данные сохранены как есть из API
   * Этот метод проверяет оба варианта для совместимости
   * @param {number} emailAttachmentId - ID вложения email
   * @returns {Promise<Array>} Отфильтрованные данные ведомости
   */
  async getFromCache(emailAttachmentId) {
    try {
      // Получаем все кэшированные ведомости
      const allStatements = await offlineCache.db.processed_statements.toArray()
      
      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: проверяем оба возможных формата полей
      const filteredStatements = allStatements.filter(statement => {
        // Приводим ID к числу для надёжного сравнения
        const targetId = Number(emailAttachmentId)
        
        // Вариант 1: snake_case поле (предпочтительный формат)
        if (statement.email_attachment_id !== undefined) {
          return Number(statement.email_attachment_id) === targetId
        }
        
        // Вариант 2: camelCase поле (если данные не были преобразованы)
        if (statement.emailAttachmentId !== undefined) {
          return Number(statement.emailAttachmentId) === targetId
        }
        
        // Если поле вообще не найдено - пропускаем запись
        console.warn('[StatementService] Запись ведомости без идентификатора вложения:', statement)
        return false
      })
      
      console.log(`[StatementService] Из кэша получено записей: ${filteredStatements.length}`)
      return filteredStatements
    } catch (error) {
      console.error('[StatementService] Ошибка получения из кэша:', error)
      throw new Error('Не удалось загрузить ведомость из кэша')
    }
  }

  /**
   * Получает ведомость с сервера через API
   * Данные в camelCase (как в API)
   * @param {number} emailAttachmentId - ID вложения email
   * @returns {Promise<Array>} Данные ведомости
   */
  async getFromApi(emailAttachmentId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/statements/${emailAttachmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      
      // API возвращает { success: true, attachmentId: 1, statements: [...] }
      // Возвращаем массив statements
      if (data.statements && Array.isArray(data.statements)) {
        return data.statements
      }
      
      // Если вдруг другой формат
      throw new Error(`Неожиданный формат ответа API для ведомости ${emailAttachmentId}`)
    } catch (error) {
      console.error('[StatementService] Ошибка получения с сервера:', error)
      throw error
    }
  }
  
  /**
   * Проверяет доступность данных в кэше для конкретной ведомости
   * @param {number} emailAttachmentId - ID вложения email
   * @returns {Promise<boolean>} true если данные есть в кэше
   */
  async hasCachedStatement(emailAttachmentId) {
    try {
      const statements = await this.getFromCache(emailAttachmentId)
      return statements.length > 0
    } catch {
      return false
    }
  }
}

// Экспортируем синглтон для использования во всем приложении
export const statementService = new StatementService()