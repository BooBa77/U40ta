/**
 * Сервис для работы с инвентаризационными книгами
 * Поддерживает онлайн/офлайн режимы работы
 * 
 * Онлайн-режим (flightMode = false): все запросы к API
 * Офлайн-режим (flightMode = true): все операции в IndexedDB
 */
import { offlineCache } from './offline-cache-service'

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

}

// Экспортируем синглтон
export const inventoryBookService = new InventoryBookService()