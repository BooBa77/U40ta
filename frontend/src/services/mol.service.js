/**
 * Сервис для работы с МОЛ (материально-ответственные лица)
 * Поддерживает онлайн/офлайн режимы работы
 */
import { offlineCache } from './offline-cache.service'

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

  // ============================================================================
  // УЧАСТИЕ В ИНВЕНТАРИЗАЦИИ
  // ============================================================================

  /**
   * Получить доступные строки инвентаризационной книги.
   * GET /api/inventory/mol/items
   * 
   * @returns {Promise<Array>} Массив строк с данными объекта и статусами
   */
  async getMolInventoryItems() {
    if (this.isFlightMode()) {
      throw new Error('Инвентаризация недоступна в офлайн-режиме')
    }

    try {
      return await this.apiRequest('/inventory/mol/items')
    } catch (error) {
      console.error('[MolService] Ошибка получения строк инвентаризации:', error)
      throw error
    }
  }

  // ============================================================================
  // ИГНОР-СЛОВА
  // ============================================================================

  /**
   * Менеджер: получить все игнор-слова текущего пользователя.
   * GET /api/mol/ignore-keywords (онлайн) или из Dexie (офлайн).
   * 
   * @returns {Promise<Array<{id: number, keyword: string}>>}
   */
  async getIgnoreKeywords() {
    return this.isFlightMode()
      ? this.getIgnoreKeywordsFromCache()
      : this.getIgnoreKeywordsFromApi()
  }

  /**
   * Исполнитель для офлайн: получает игнор-слова из IndexedDB.
   * В Dexie хранятся как { id, keyword }, где id — локальный автоинкремент.
   * 
   * @returns {Promise<Array<{id: number, keyword: string}>>}
   */
  async getIgnoreKeywordsFromCache() {
    try {
      const keywords = await offlineCache.getAllIgnoreKeywords()
      // В Dexie ключ — автоинкрементный id, значение — строка keyword.
      // getAllIgnoreKeywords возвращает массив строк, но нам нужны объекты { id, keyword }.
      // Получаем сырые записи из таблицы.
      const records = await offlineCache.db.ignore_keywords.toArray()
      console.log(`[MolService] Из кэша получено игнор-слов: ${records.length}`)
      return records
    } catch (error) {
      console.error('[MolService] Ошибка получения игнор-слов из кэша:', error)
      throw new Error('Не удалось загрузить игнор-слова из кэша')
    }
  }

  /**
   * Исполнитель для онлайн: получает игнор-слова через API.
   * 
   * @returns {Promise<Array<{id: number, keyword: string}>>}
   */
  async getIgnoreKeywordsFromApi() {
    try {
      const data = await this.apiRequest('/mol/ignore-keywords')
      return data.keywords || []
    } catch (error) {
      console.error('[MolService] Ошибка получения игнор-слов через API:', error)
      throw error
    }
  }

  /**
   * Менеджер: добавить игнор-слово.
   * POST /api/mol/ignore-keywords (онлайн) или в Dexie (офлайн).
   * 
   * @param {string} keyword — ключевое слово
   * @returns {Promise<{id: number, keyword: string}>}
   */
  async addIgnoreKeyword(keyword) {
    if (this.isFlightMode()) {
      return this.addIgnoreKeywordToCache(keyword)
    }
    return this.addIgnoreKeywordToApi(keyword)
  }

  /**
   * Исполнитель для офлайн: добавляет игнор-слово в IndexedDB.
   * 
   * @param {string} keyword — ключевое слово
   * @returns {Promise<{id: number, keyword: string}>}
   */
  async addIgnoreKeywordToCache(keyword) {
    try {
      const trimmed = keyword.trim()
      if (!trimmed) {
        throw new Error('Ключевое слово не может быть пустым')
      }

      // Проверяем на дубликат
      const existing = await offlineCache.db.ignore_keywords
        .where('keyword')
        .equals(trimmed)
        .first()

      if (existing) {
        throw new Error(`Ключевое слово "${trimmed}" уже добавлено`)
      }

      const id = await offlineCache.db.ignore_keywords.add({ keyword: trimmed })
      console.log(`[MolService] Игнор-слово "${trimmed}" добавлено в кэш, id=${id}`)
      return { id, keyword: trimmed }
    } catch (error) {
      console.error('[MolService] Ошибка добавления игнор-слова в кэш:', error)
      throw error
    }
  }

  /**
   * Исполнитель для онлайн: добавляет игнор-слово через API.
   * 
   * @param {string} keyword — ключевое слово
   * @returns {Promise<{id: number, keyword: string}>}
   */
  async addIgnoreKeywordToApi(keyword) {
    try {
      const data = await this.apiRequest('/mol/ignore-keywords', {
        method: 'POST',
        body: { keyword }
      })
      return data.keyword
    } catch (error) {
      console.error('[MolService] Ошибка добавления игнор-слова через API:', error)
      throw error
    }
  }

  /**
   * Менеджер: удалить игнор-слово по ID.
   * DELETE /api/mol/ignore-keywords/:id (онлайн) или из Dexie (офлайн).
   * 
   * @param {number} id — ID записи
   * @returns {Promise<void>}
   */
  async removeIgnoreKeyword(id) {
    if (this.isFlightMode()) {
      return this.removeIgnoreKeywordFromCache(id)
    }
    return this.removeIgnoreKeywordFromApi(id)
  }

  /**
   * Исполнитель для офлайн: удаляет игнор-слово из IndexedDB.
   * 
   * @param {number} id — ID записи
   * @returns {Promise<void>}
   */
  async removeIgnoreKeywordFromCache(id) {
    try {
      await offlineCache.db.ignore_keywords.delete(id)
      console.log(`[MolService] Игнор-слово с id=${id} удалено из кэша`)
    } catch (error) {
      console.error('[MolService] Ошибка удаления игнор-слова из кэша:', error)
      throw new Error('Не удалось удалить игнор-слово из кэша')
    }
  }

  /**
   * Исполнитель для онлайн: удаляет игнор-слово через API.
   * 
   * @param {number} id — ID записи
   * @returns {Promise<void>}
   */
  async removeIgnoreKeywordFromApi(id) {
    try {
      await this.apiRequest(`/mol/ignore-keywords/${id}`, {
        method: 'DELETE'
      })
      console.log(`[MolService] Игнор-слово с id=${id} удалено через API`)
    } catch (error) {
      console.error('[MolService] Ошибка удаления игнор-слова через API:', error)
      throw error
    }
  }

  /**
   * Менеджер: заменить список игнор-слов и пересчитать ведомости.
   * Онлайн: POST /api/mol/ignore-keywords/replace-and-apply
   * Офлайн: замена в Dexie + пересчёт statements.
   * 
   * @param {string[]} newKeywords — новый список ключевых слов
   * @returns {Promise<{success: boolean, updatedCount: number, message: string}>}
   */
  async replaceAndApplyIgnoreKeywords(newKeywords) {
      if (this.isFlightMode()) {
          return this.replaceAndApplyInCache(newKeywords)
      }
      return this.replaceAndApplyInApi(newKeywords)
  }

  /**
   * Исполнитель для офлайн.
   */
  async replaceAndApplyInCache(newKeywords) {
      try {
          const normalized = [...new Set(
              newKeywords.map(k => k.trim()).filter(k => k.length > 0)
          )]

          // 1. Заменяем список в Dexie
          await offlineCache.replaceIgnoreKeywords(normalized)

          // 2. Всем statements ставим isActual = true
          const allStatements = await offlineCache.db.statements.toArray()
          for (const stmt of allStatements) {
              if (stmt.isActual !== true) {
                  stmt.isActual = true
                  await offlineCache.db.statements.put(stmt)
              }
          }

          // 3. Для каждого слова проставляем isActual = false
          let totalUpdated = 0

          const containsWord = (text, word) => {
              if (!text || !word) return false
              const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const regex = new RegExp(
                  `(^|[^\\w-])(${escaped})([^\\w-]|$)`,
                  'iu'
              )
              return regex.test(text)
          }

          for (const keyword of normalized) {
              for (const stmt of allStatements) {
                  if (stmt.buhName && containsWord(stmt.buhName, keyword) && stmt.isActual !== false) {
                      stmt.isActual = false
                      await offlineCache.db.statements.put(stmt)
                      totalUpdated++
                  }
              }
          }

          console.log(`[MolService] Офлайн: заменён список (${normalized.length} слов), обновлено ${totalUpdated} строк`)
          return {
              success: true,
              updatedCount: totalUpdated,
              message: `Обновлено ${totalUpdated} записей в ведомостях`
          }
      } catch (error) {
          console.error('[MolService] Ошибка замены и применения в кэше:', error)
          throw new Error('Не удалось применить игнор-слова в офлайн-режиме')
      }
  }

  /**
   * Исполнитель для онлайн.
   */
  async replaceAndApplyInApi(newKeywords) {
      try {
          const data = await this.apiRequest('/mol/ignore-keywords/replace-and-apply', {
              method: 'POST',
              body: { keywords: newKeywords }
          })
          return data
      } catch (error) {
          console.error('[MolService] Ошибка замены и применения через API:', error)
          throw error
      }
  }
}

// Экспортируем синглтон
export const molService = new MolService()