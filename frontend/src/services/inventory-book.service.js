/**
 * Сервис для работы с инвентаризационными книгами
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'
import { logsService } from './logs-service'

export class InventoryBookService {
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
  // СОЗДАНИЕ КНИГ
  //============================================================================

  /**
   * Создать новую книгу.
   * Только онлайн.
   * 
   * @param {string} name - Название книги
   * @param {Array} items - Массив строк книги
   * @returns {Promise<Object>} Созданная книга
   */
  async createBook(name, items) {
    if (this.isFlightMode()) {
      throw new Error('Создание книги недоступно в офлайн-режиме')
    }

    try {
      const data = await this.apiRequest('/inventory/books', {
        method: 'POST',
        body: { name, items }
      })
      return data.book
    } catch (error) {
      console.error('[InventoryBookService] Ошибка создания книги:', error)
      throw error
    }
  }

  /**
   * Обновить книгу (название и другие поля).
   * Только онлайн.
   * 
   * @param {number} bookId - ID книги
   * @param {Object} updates - Поля для обновления
   * @returns {Promise<Object>} Обновлённая книга
   */
  async updateBook(bookId, updates) {
    if (this.isFlightMode()) {
      throw new Error('Редактирование книги недоступно в офлайн-режиме')
    }

    try {
      const data = await this.apiRequest(`/inventory/books/${bookId}`, {
        method: 'PATCH',
        body: updates
      })
      return data.book
    } catch (error) {
      console.error('[InventoryBookService] Ошибка обновления книги:', error)
      throw error
    }
}

  //============================================================================
  // ПОЛУЧЕНИЕ СПИСКА КНИГ
  //============================================================================

  /**
   * Получает все инвентаризационные книги, доступные текущему ревизору
   * @returns {Promise<Array>} Массив книг
   */
  async getAllBooks() {
    if (this.isFlightMode()) {
      console.log('[InventoryBookService] Офлайн-режим: получение книг из кэша')
      return this.getBooksFromCache()
    }

    console.log('[InventoryBookService] Онлайн-режим: получение книг с сервера')
    return this.getBooksFromApi()
  }

  /**
   * Получает книги из кэша IndexedDB
   * @returns {Promise<Array>} Массив книг
   */
  async getBooksFromCache() {
    try {
      const books = await offlineCache.getAllInventoryBooks()
      console.log(`[InventoryBookService] Из кэша получено книг: ${books.length}`)
      return books
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения книг из кэша:', error)
      throw new Error('Не удалось загрузить книги из кэша')
    }
  }

  /**
   * Получает книги с сервера через API
   * @returns {Promise<Array>} Массив книг
   */
  async getBooksFromApi() {
    try {
      const data = await this.apiRequest('/inventory/books')
      
      if (data.books && Array.isArray(data.books)) {
        return data.books
      }
      
      throw new Error('Неожиданный формат ответа API для списка книг')
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения книг с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ ОДНОЙ КНИГИ
  //============================================================================

  /**
   * Получает одну книгу по ID
   * @param {string|number} bookId - ID книги
   * @returns {Promise<Object>} Данные книги
   */
  async getBook(bookId) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      console.log(`[InventoryBookService] Офлайн-режим: получение книги ${id} из кэша`)
      return this.getBookFromCache(id)
    }

    console.log(`[InventoryBookService] Онлайн-режим: получение книги ${id} с сервера`)
    return this.getBookFromApi(id)
  }

  /**
   * Получает книгу из кэша IndexedDB
   * @param {number} bookId - ID книги
   * @returns {Promise<Object>} Данные книги
   */
  async getBookFromCache(bookId) {
    try {
      const book = await offlineCache.getInventoryBook(bookId)
      if (!book) {
        throw new Error(`Книга с ID ${bookId} не найдена в кэше`)
      }
      return book
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения книги из кэша:', error)
      throw error
    }
  }

  /**
   * Получает книгу с сервера через API
   * @param {number} bookId - ID книги
   * @returns {Promise<Object>} Данные книги
   */
  async getBookFromApi(bookId) {
    try {
      const data = await this.apiRequest(`/inventory/books/${bookId}`)
      
      if (data.book) {
        return data.book
      }
      
      throw new Error(`Неожиданный формат ответа API для книги ${bookId}`)
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения книги с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // ПОЛУЧЕНИЕ СТРОК КНИГИ
  //============================================================================

  /**
   * Получает все строки инвентаризационной книги
   * @param {string|number} bookId - ID книги
   * @returns {Promise<Array>} Массив строк книги
   */
  async getBookItems(bookId) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      console.log(`[InventoryBookService] Офлайн-режим: получение строк книги ${id} из кэша`)
      return this.getBookItemsFromCache(id)
    }

    console.log(`[InventoryBookService] Онлайн-режим: получение строк книги ${id} с сервера`)
    return this.getBookItemsFromApi(id)
  }

  /**
   * Получает строки книги из кэша IndexedDB
   * @param {number} bookId - ID книги
   * @returns {Promise<Array>} Массив строк книги
   */
  async getBookItemsFromCache(bookId) {
    try {
      const items = await offlineCache.getInventoryBookItems(bookId)
      console.log(`[InventoryBookService] Из кэша получено строк: ${items.length}`)
      return items
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения строк из кэша:', error)
      throw new Error('Не удалось загрузить строки книги из кэша')
    }
  }

  /**
   * Получает строки книги с сервера через API
   * @param {number} bookId - ID книги
   * @returns {Promise<Array>} Массив строк книги
   */
  async getBookItemsFromApi(bookId) {
    try {
      const data = await this.apiRequest(`/inventory/books/${bookId}/items`)
      
      if (data.items && Array.isArray(data.items)) {
        return data.items
      }
      
      throw new Error(`Неожиданный формат ответа API для строк книги ${bookId}`)
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения строк с сервера:', error)
      throw error
    }
  }

  //============================================================================
  // УДАЛЕНИЕ КНИГИ (ТОЛЬКО ОНЛАЙН)
  //============================================================================

  /**
   * Удаляет инвентаризационную книгу
   * Доступно только в онлайн-режиме
   * @param {string|number} bookId - ID книги
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteBook(bookId) {
    if (this.isFlightMode()) {
      throw new Error('Удаление книги недоступно в офлайн-режиме')
    }

    const id = Number(bookId)

    try {
      const data = await this.apiRequest(`/inventory/books/${id}`, {
        method: 'DELETE'
      })
      return data
    } catch (error) {
      console.error('[InventoryBookService] Ошибка удаления книги:', error)
      throw error
    }
  }

  // ============================================================================
  // УПРАВЛЕНИЕ ДОСТУПОМ К КНИГЕ
  // ============================================================================

  /**
   * Получить список ревизоров с доступом к книге.
   * @param {string|number} bookId - ID книги
   * @returns {Promise<Array>} Массив записей доступа
   */
  async getBookAccess(bookId) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      throw new Error('Управление доступом недоступно в офлайн-режиме')
    }

    try {
      const data = await this.apiRequest(`/inventory/books/${id}/access`)
      return data.access
    } catch (error) {
      console.error('[InventoryBookService] Ошибка получения доступа:', error)
      throw error
    }
  }

  /**
   * Добавить ревизора к книге.
   * @param {string|number} bookId - ID книги
   * @param {number} userId - ID пользователя
   */
  async addBookAccess(bookId, userId) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      throw new Error('Управление доступом недоступно в офлайн-режиме')
    }

    try {
      await this.apiRequest(`/inventory/books/${id}/access`, {
        method: 'POST',
        body: { userId }
      })
    } catch (error) {
      console.error('[InventoryBookService] Ошибка добавления доступа:', error)
      throw error
    }
  }

  /**
   * Удалить ревизора из книги.
   * @param {string|number} bookId - ID книги
   * @param {number} userId - ID пользователя
   */
  async removeBookAccess(bookId, userId) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      throw new Error('Управление доступом недоступно в офлайн-режиме')
    }

    try {
      await this.apiRequest(`/inventory/books/${id}/access/${userId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('[InventoryBookService] Ошибка удаления доступа:', error)
      throw error
    }
  }  

  // ============================================================================
  // ИГНОРИРОВАНИЕ ОБЪЕКТОВ ПРИ ИНВЕНТАРИЗАЦИИ
  // ============================================================================

  /**
   * Обновляет статус актуальности для всех строк с указанным invNumber в книге
   * 
   * @param {number} bookId - ID книги
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение актуальности
   * @returns {Promise<Object>} Результат операции { success: true }
   */
  async updateActualStatus(bookId, invNumber, isActual) {
    if (this.isFlightMode()) {
      console.log(`[InventoryBookService] Офлайн-режим: обновление isActual для ${invNumber} в книге ${bookId}`)
      return this.updateActualStatusInCache(bookId, invNumber, isActual)
    }

    console.log(`[InventoryBookService] Онлайн-режим: обновление isActual для ${invNumber} в книге ${bookId}`)
    return this.updateActualStatusInApi(bookId, invNumber, isActual)
  }

  /**
   * Обновляет isActual в кэше IndexedDB
   * 
   * @param {number} bookId - ID книги
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение
   * @returns {Promise<Object>}
   */
  async updateActualStatusInCache(bookId, invNumber, isActual) {
    try {
      await offlineCache.updateInventoryBookItemsActual(bookId, invNumber, isActual)
      console.log(`[InventoryBookService] Книга ${bookId}: обновлён isActual=${isActual} для invNumber=${invNumber}`)
      return { success: true }
    } catch (error) {
      console.error('[InventoryBookService] Ошибка обновления isActual в кэше:', error)
      throw new Error('Не удалось обновить статус актуальности в кэше')
    }
  }

  /**
   * Обновляет isActual через API
   * 
   * @param {number} bookId - ID книги
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение
   * @returns {Promise<Object>}
   */
  async updateActualStatusInApi(bookId, invNumber, isActual) {
    try {
      await this.apiRequest(`/inventory/books/${bookId}/items/update-actual`, {
        method: 'POST',
        body: { invNumber, isActual }
      })
      return { success: true }
    } catch (error) {
      console.error('[InventoryBookService] Ошибка обновления isActual через API:', error)
      throw error
    }
  }
  
  // ============================================================================
  // ПОДТВЕРЖДЕНИЕ НАЛИЧИЯ
  // ============================================================================

  /**
   * Менеджер: подтверждает наличие для указанных строк книги.
   * @param {number} bookId - ID книги
   * @param {Array<number>} itemIds - ID строк для подтверждения
   * @param {Object} data - данные подтверждения
   * @param {boolean} [data.isOkManual] - ручное подтверждение
   * @param {boolean} [data.isOkAuto] - авто подтверждение
   * @param {string} [data.rem] - комментарий
   * @param {number} [data.idObject] - ID объекта
   * @param {string} [data.placeTer] - территория
   * @param {string} [data.placePos] - здание
   * @param {string} [data.placeCab] - кабинет
   * @param {string} [data.placeUser] - пользователь
   * @param {string} [data.dateOkManualChecked] - дата ручного подтверждения
   * @param {string} [data.dateOkAutoChecked] - дата авто подтверждения
   * @returns {Promise<Object>} результат { success, confirmedCount }
   */
  async confirmItems(bookId, itemIds, data) {
    const id = Number(bookId)

    if (this.isFlightMode()) {
      console.log(`[InventoryBookService] Офлайн-режим: подтверждение ${itemIds.length} строк в книге ${id}`)
      return this.confirmItemsInCache(id, itemIds, data)
    }

    console.log(`[InventoryBookService] Онлайн-режим: подтверждение ${itemIds.length} строк в книге ${id}`)
    return this.confirmItemsInApi(id, itemIds, data)
  }

  /**
   * Исполнитель для API.
   */
  async confirmItemsInApi(bookId, itemIds, data) {
    try {
      const result = await this.apiRequest(`/inventory/books/${bookId}/items/confirm`, {
        method: 'POST',
        body: {
          itemIds,
          ...data
        }
      })
      return result
    } catch (error) {
      console.error('[InventoryBookService] Ошибка подтверждения через API:', error)
      throw error
    }
  }

  /**
   * Исполнитель для кэша.
   */
  async confirmItemsInCache(bookId, itemIds, data) {
    try {
      const updatedItems = await offlineCache.confirmInventoryBookItems(bookId, itemIds, data)
      
      // Логируем изменения для каждой обновлённой строки
      for (const item of updatedItems) {
        let eventType, storyLine
        
        if (data.isOkManual === false) {
          eventType = 'manualCancel'
          storyLine = 'Ручное подтверждение отменено'
        } else if (data.isOkManual === true) {
          eventType = 'manualConfirm'
          storyLine = 'Подтверждено вручную'
        } else if (data.isOkAuto === true) {
          eventType = 'autoConfirm'
          storyLine = 'Подтверждено по QR-коду'
        } else {
          eventType = 'updated'
          storyLine = 'Обновлены данные строки'
        }
        
        if (data.rem !== undefined) {
          storyLine += data.rem ? `. Комментарий: ${data.rem}` : '. Комментарий очищен'
        }
        
        await logsService.addInventoryBookItemHistory(
          item.idInventoryStatement,
          eventType,
          storyLine
        )
      }
      
      return { success: true, confirmedCount: itemIds.length }
    } catch (error) {
      console.error('[InventoryBookService] Ошибка подтверждения в кэше:', error)
      throw new Error('Не удалось подтвердить строки в кэше')
    }
  }

  // ============================================================================
  // ВЫГРУЗКА КНИГИ В EXCEL
  // ============================================================================

  /**
   * Выгрузить книгу в Excel и отправить на почту текущему пользователю.
   * Только онлайн.
   * 
   * POST /api/inventory/books/:id/export-excel
   * 
   * @param {string|number} bookId - ID книги
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async exportBookToExcel(bookId) {
    if (this.isFlightMode()) {
      throw new Error('Выгрузка в Excel недоступна в офлайн-режиме')
    }

    const id = Number(bookId)

    try {
      const data = await this.apiRequest(`/inventory/books/${id}/export-excel`, {
        method: 'POST'
      })
      return data
    } catch (error) {
      console.error('[InventoryBookService] Ошибка выгрузки в Excel:', error)
      throw error
    }
  }  

}

// Экспортируем синглтон
export const inventoryBookService = new InventoryBookService()