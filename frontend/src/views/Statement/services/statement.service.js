/**
 * Сервис для работы с ведомостями (statements)
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from '../../../services/offline-cache-service'

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

  /**
   * Обновляет статус игнорирования для группы строк
   * @param {number} attachmentId - ID ведомости
   * @param {string} invNumber - Инвентарный номер
   * @param {string} partyNumber - Номер партии (может быть пустым)
   * @param {boolean} isIgnore - Новое значение is_ignore
   * @returns {Promise<boolean>} true если успешно
   */
  async updateIgnoreStatus(attachmentId, invNumber, partyNumber, isIgnore) {
    const attachmentIdNum = Number(attachmentId)
    
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: обновление is_ignore для ${invNumber}/${partyNumber}`)
      return this.updateIgnoreInCache(attachmentIdNum, invNumber, partyNumber, isIgnore)
    }
    
    console.log(`[StatementService] Онлайн-режим: обновление is_ignore для ${invNumber}/${partyNumber}`)
    return this.updateIgnoreInApi(attachmentIdNum, invNumber, partyNumber, isIgnore)
  }

  /**
   * Обновляет is_ignore в кэше IndexedDB
   */
  async updateIgnoreInCache(attachmentId, invNumber, partyNumber, isIgnore) {
    try {
      console.log(`[StatementService] Обновление is_ignore в кэше:`, {
        attachmentId,
        invNumber,
        partyNumber: partyNumber || '(пусто)',
        isIgnore
      })
      
      // Получаем ВСЕ записи из кэша
      const allStatements = await offlineCache.db.processed_statements.toArray()
      
      // Находим записи для обновления
      const statementsToUpdate = []
      
      for (const statement of allStatements) {
        // Проверяем attachmentId
        const stAttachmentId = statement.emailAttachmentId
        if (Number(stAttachmentId) !== attachmentId) continue
        
        // Проверяем inv_number
        const stInv = statement.inv_number
        if (stInv !== invNumber) continue
        
        // Проверяем party_number
        const stParty = statement.party_number || ''
        const targetParty = partyNumber || ''
        
        // Для пустых партий - exact match
        if (stParty !== targetParty) continue
        
        statementsToUpdate.push(statement)
      }
      
      console.log(`[StatementService] Найдено записей для обновления: ${statementsToUpdate.length}`)
      
      if (statementsToUpdate.length === 0) {
        console.warn(`[StatementService] Не найдено записей для обновления`)
        return false
      }
      
      // Обновляем записи
      for (const statement of statementsToUpdate) {
        statement.is_ignore = isIgnore
        // put обновит запись по primary key (id)
        await offlineCache.db.processed_statements.put(statement)
        console.log(`[StatementService] Обновлена запись ID: ${statement.id}, is_ignore=${isIgnore}`)
      }
      
      return true
      
    } catch (error) {
      console.error('[StatementService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить статус в кэше')
    }
  }

  /**
   * Обновляет is_ignore через API
   */
  async updateIgnoreInApi(attachmentId, invNumber, partyNumber, isIgnore) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/statements/ignore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attachmentId,
          invNumber,
          partyNumber,
          isIgnore
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      const data = await response.json()
      return data.success === true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления через API:', error)
      throw error
    }
  }

  /**
   * Обновляет статус have_object для записи ведомости
   */
  async updateStatementHaveObject(attachmentId, statementId, haveObject) {
    const attachmentIdNum = Number(attachmentId)
    const statementIdNum = Number(statementId)
    
    if (this.isFlightMode()) {
      console.log(`[StatementService] Офлайн-режим: обновление have_object для записи ${statementIdNum}`)
      return this.updateHaveObjectInCache(attachmentIdNum, statementIdNum, haveObject)
    }
    
    console.log(`[StatementService] Онлайн-режим: обновление have_object для записи ${statementIdNum}`)
    return this.updateHaveObjectInApi(attachmentIdNum, statementIdNum, haveObject)
  }

  /**
   * Обновляет have_object в кэше IndexedDB
   */
  async updateHaveObjectInCache(attachmentId, statementId, haveObject) {
    try {
      console.log(`[StatementService] Обновление have_object в кэше:`, {
        attachmentId,
        statementId,
        haveObject
      })
      
      const statement = await offlineCache.db.processed_statements
        .where('id')
        .equals(statementId)
        .first()
      
      if (!statement) {
        throw new Error(`Запись ведомости ${statementId} не найдена`)
      }
      
      statement.have_object = haveObject
      statement.updated_at = new Date().toISOString()
      
      await offlineCache.db.processed_statements.put(statement)
      
      console.log(`[StatementService] Запись обновлена: ID ${statementId}, have_object=${haveObject}`)
      return true
      
    } catch (error) {
      console.error('[StatementService] Ошибка обновления в кэше:', error)
      throw new Error('Не удалось обновить запись ведомости в кэше')
    }
  }

  /**
   * Обновляет have_object через API
   */
  async updateHaveObjectInApi(attachmentId, statementId, haveObject) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Токен авторизации не найден')
      }

      const response = await fetch(`${this.baseUrl}/statements/update-have-object`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attachmentId,
          statementId,
          haveObject
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }

      return true
    } catch (error) {
      console.error('[StatementService] Ошибка обновления через API:', error)
      throw error
    }
  }  


}

// Экспортируем синглтон для использования во всем приложении
export const statementService = new StatementService()