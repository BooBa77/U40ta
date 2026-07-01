import Dexie from 'dexie'
import { offlineSyncService } from './offline-sync.service'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    this.db.version(8).stores({
      statements: 'id, userId, receivedAt, docType, description, zavod, sklad, invNumber, partyNumber, buhName, isActual',
      objects: 'id, zavod, sklad, buhName, invNumber, partyNumber, sn, isWrittenOff, checkedAt, placeTer, placePos, placeCab, placeUser',
      qr_codes: '++id, qrValue, objectId',
      photos: '++id, objectId',
      logs: '++id, source, time, content',
      inventory_books: 'id, createdAt, idOwner',
      inventory_book_items: 'id, idBook, idInventoryStatement, zavod, sklad, invNumber, partyNumber, idObject, isActual, isOkManual, isOkAuto, dateOkManualChecked, dateOkAutoChecked, placeTer, placePos, placeCab, placeUser, rem',
      proposed_changes: '++id, objectId, changeType, userId, createdAt, isDeleted'
    })    
  }

  // ============================================================================
  // ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ПОЛЁТА
  // ============================================================================

  /**
   * Включает режим полёта: загружает данные с бэкенда и сохраняет в кэш
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async enableFlightMode() {
    console.log('[OfflineCache] Включение режима полёта...')
    
    try {
      const response = await fetch('/api/offline/data', {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Бэкенд вернул ошибку')
      }
      
      const data = result.data
      
      if (!data) {
        throw new Error('Ответ бэкенда не содержит данных')
      }
      
      console.log('[OfflineCache] Данные получены:', {
        statements: data.statements?.length || 0,
        objects: data.objects?.length || 0,
        qr_codes: data.qr_codes?.length || 0,
        inventory_books: data.inventory_books?.length || 0,
        inventory_book_items: data.inventory_book_items?.length || 0
      })
      
      const cacheResult = await this.cacheAllData(data)
      if (!cacheResult.success) {
        throw new Error(cacheResult.error)
      }
      
      console.log('[OfflineCache] Режим полёта успешно включён')
      return { success: true, error: null }
      
    } catch (error) {
      console.error('[OfflineCache] Ошибка включения режима полёта:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Выключает режим полёта: очищает весь кэш
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async disableFlightMode() {
    console.log('[OfflineCache] Выключение режима полёта...')
    
    try {
      const syncResult = await offlineSyncService.synchronize()
      
      if (!syncResult.success) {
        throw new Error(syncResult.message || 'Синхронизация не удалась')
      }
      
      console.log(`[OfflineCache] Синхронизировано объектов: ${syncResult.syncedCount}`)
      
      await this.clearAllCache()
      
      console.log('[OfflineCache] Режим полёта выключен, кэш очищен')
      return { success: true, error: null, syncedCount: syncResult.syncedCount }
      
    } catch (error) {
      console.error('[OfflineCache] Ошибка при выключении режима полёта:', error)
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // УПРАВЛЕНИЕ КЭШЕМ
  // ============================================================================

  /**
   * Кэширует все данные для офлайн-режима.
   * Предварительно очищает кэш для гарантии актуальности.
   * 
   * @param {Object} data — объект с данными от бэкенда в camelCase
   * @param {Array} data.statements — массив строк ведомостей МОЛ
   * @param {Array} data.objects — массив объектов
   * @param {Array} data.qr_codes — массив QR-кодов
   * @param {Array} data.photos — массив фото из предлагаемых изменений
   * @param {Array} data.proposed_changes — массив предлагаемых изменений для складов МОЛа
   * @param {Array} data.inventory_books — массив инвентаризационных книг
   * @param {Array} data.inventory_book_items — массив строк инвентаризационных книг
   * @returns {Promise<{success: boolean, error: string|null, stats: Object}>}
   */
  async cacheAllData(data) {
    console.log('[OfflineCache] Начинаем кэширование данных...')
    
    const {
      statements = [],
      objects = [],
      qr_codes = [],
      photos = [],
      proposed_changes = [],
      inventory_books = [],
      inventory_book_items = []
    } = data

    try {
      await this.clearAllCache()
      
      let stats = {
        statements: 0,
        objects: 0,
        qr_codes: 0,
        photos: 0,
        proposed_changes: 0,
        inventory_books: 0,
        inventory_book_items: 0
      }
      
      if (statements.length) {
        await this.db.statements.bulkAdd(statements)
        stats.statements = statements.length
      }

      if (objects.length) {
        await this.db.objects.bulkAdd(objects)
        stats.objects = objects.length
      }
      
      if (qr_codes.length) {
        await this.db.qr_codes.bulkAdd(qr_codes)
        stats.qr_codes = qr_codes.length
      }

      if (photos.length) {
        await this.db.photos.bulkAdd(photos)
        stats.photos = photos.length
      }

      if (proposed_changes.length) {
        const withFlags = proposed_changes.map(c => ({
          ...c,
          isDeleted: false
        }))
        await this.db.proposed_changes.bulkAdd(withFlags)
        stats.proposed_changes = proposed_changes.length
      }

      if (inventory_books.length) {
        await this.db.inventory_books.bulkAdd(inventory_books)
        stats.inventory_books = inventory_books.length
      }

      if (inventory_book_items.length) {
        await this.db.inventory_book_items.bulkAdd(inventory_book_items)
        stats.inventory_book_items = inventory_book_items.length
      }
      
      console.log('[OfflineCache] Кэширование завершено:', stats)
      return { success: true, error: null, stats }
      
    } catch (error) {
      console.error('[OfflineCache] Ошибка при кэшировании:', error)
      return { success: false, error: error.message, stats: null }
    }
  }

  // ============================================================================
  // ОЧИСТКА КЭША
  // ============================================================================

  /**
   * Полностью очищает весь кэш.
   */
  async clearAllCache() {
    console.log('[OfflineCache] Очищаем весь кэш...')
    
    await Promise.all([
      this.db.statements.clear(),
      this.db.objects.clear(),
      this.db.qr_codes.clear(),
      this.db.photos.clear(),
      this.db.logs.clear(),
      this.db.inventory_books.clear(),
      this.db.inventory_book_items.clear(),
      this.db.proposed_changes.clear()
    ])
    
    console.log('[OfflineCache] Кэш очищен')
  }

  // ============================================================================
  // РАБОТА С ВЕДОМОСТЯМИ МОЛ (statements)
  // ============================================================================

  /**
   * Получает все строки ведомостей из кэша.
   * @returns {Promise<Array>} Массив всех строк statements
   */
  async getAllStatements() {
    return await this.db.statements.toArray()
  }

  /**
   * Получает строки ведомости по дате получения.
   * @param {string} receivedAt - дата получения ведомости в ISO формате
   * @returns {Promise<Array>} Массив строк ведомости
   */
  async getStatementsByReceivedAt(receivedAt) {
    const allStatements = await this.db.statements.toArray()
    
    const filtered = allStatements.filter(s => s.receivedAt === receivedAt)
    
    console.log(`[OfflineCache] Получено записей для receivedAt ${receivedAt}: ${filtered.length}`)
    return filtered
  }

  /**
   * Удаляет все строки ведомости по дате получения.
   * @param {string} receivedAt - дата получения ведомости
   * @returns {Promise<number>} Количество удалённых записей
   */
  async deleteStatementsByReceivedAt(receivedAt) {
    const allStatements = await this.db.statements.toArray()
    const toDelete = allStatements.filter(s => s.receivedAt === receivedAt)
    
    for (const s of toDelete) {
      await this.db.statements.delete(s.id)
    }
    
    console.log(`[OfflineCache] Удалено записей для receivedAt ${receivedAt}: ${toDelete.length}`)
    return toDelete.length
  }

  /**
   * Обновляет поле isActual для всех записей ведомости с указанным receivedAt и invNumber.
   * @param {string} receivedAt - дата получения ведомости
   * @param {string} invNumber - инвентарный номер
   * @param {boolean} isActual - новое значение isActual
   * @returns {Promise<void>}
   */

  async updateStatementsActualByInv(receivedAt, invNumber, isActual) {
    const allStatements = await this.db.statements.toArray()
    
    const statementsToUpdate = allStatements.filter(s => {
      return s.receivedAt === receivedAt && s.invNumber === invNumber
    })
    
    if (statementsToUpdate.length === 0) {
      console.warn(`[OfflineCache] Не найдено записей для обновления: receivedAt=${receivedAt}, invNumber=${invNumber}`)
      return
    }
    
    for (const statement of statementsToUpdate) {
      statement.isActual = isActual
      await this.db.statements.put(statement)
    }
    
    console.log(`[OfflineCache] Обновлено ${statementsToUpdate.length} записей: isActual=${isActual}`)
  }

  /**
   * Получает записи ведомости по инвентарному номеру.
   * @param {string} inv - инвентарный номер
   * @param {string} [partyNumber] - номер партии
   * @param {number} [zavod] - номер завода
   * @param {string} [sklad] - код склада
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getStatementsByInv(inv, partyNumber, zavod, sklad) {
    let statements = await this.db.statements.toArray()
    
    statements = statements.filter(s => s.invNumber === inv)
    
    if (partyNumber !== undefined && partyNumber !== null && partyNumber !== '') {
      statements = statements.filter(s => s.partyNumber === partyNumber)
    }
    
    if (zavod !== undefined && zavod !== null) {
      const targetZavod = Number(zavod)
      statements = statements.filter(s => Number(s.zavod) === targetZavod)
    }
    
    if (sklad !== undefined && sklad !== null) {
      statements = statements.filter(s => s.sklad === sklad)
    }
    
    console.log(`[OfflineCache] Найдено записей по inv=${inv}: ${statements.length}`)
    return statements
  }

  // ============================================================================
  // РАБОТА С ОБЪЕКТАМИ
  // ============================================================================

  /**
   * Получает объект по ID.
   * @param {number} id - ID объекта
   * @returns {Promise<Object|null>}
   */
  async getObject(id) {
    return await this.db.objects.get(id)
  }

  /**
   * Добавляет новый объект.
   * @param {Object} object - Данные объекта
   * @returns {Promise<number>} ID созданного объекта
   */
  async addObject(object) {
    return await this.db.objects.add(object)
  }

  /**
   * Обновляет существующий объект.
   * @param {number} id - ID объекта
   * @param {Object} updates - Поля для обновления
   * @returns {Promise<Object>} Обновлённый объект
   */
  async updateObject(id, updates) {
    await this.db.objects.update(id, updates)
    return await this.getObject(id)
  }

  /**
   * Получает все объекты.
   * @returns {Promise<Array>}
   */
  async getAllObjects() {
    return await this.db.objects.toArray()
  }

  /**
   * Ищет объекты по инвентарному номеру.
   * @param {string} inv - Инвентарный номер
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>}
   */
  async findObjectsByInv(inv, partyNumber, zavod, sklad) {
    const allObjects = await this.db.objects.toArray()
    let objects = allObjects.filter(obj => obj.invNumber === inv)
    
    if (partyNumber !== undefined && partyNumber !== null && partyNumber !== '') {
      objects = objects.filter(obj => obj.partyNumber === partyNumber)
    }
    
    if (zavod !== undefined && zavod !== null) {
      objects = objects.filter(obj => obj.zavod === zavod)
    }
    
    if (sklad !== undefined && sklad !== null && sklad !== '') {
      objects = objects.filter(obj => obj.sklad === sklad)
    }
    
    console.log(`[OfflineCache] findObjectsByInv: inv=${inv}, party=${partyNumber}, zavod=${zavod}, sklad=${sklad}, найдено: ${objects.length}`)
    return objects
  }

  /**
   * Находит объекты в кэше по заводу и складу.
   * @param {number} zavod - номер завода
   * @param {string} sklad - код склада
   * @returns {Promise<Array>} Массив объектов
   */
  async findObjectsByZavodSklad(zavod, sklad) {
    const allObjects = await this.db.objects.toArray()
    
    const filtered = allObjects.filter(obj => {
      return obj.zavod === zavod && obj.sklad === sklad
    })
    
    console.log(`[OfflineCache] Найдено объектов для zavod=${zavod}, sklad=${sklad}: ${filtered.length}`)
    return filtered
  }

  // ============================================================================
  // РАБОТА С QR-КОДАМИ
  // ============================================================================

  /**
   * Находит QR-код по его значению.
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>} Запись QR-кода или null
   */
  async getQrCode(qrValue) {
    return await this.db.qr_codes
      .where('qrValue')
      .equals(qrValue)
      .first()
  }

  /**
   * Находит все QR-коды, привязанные к объекту.
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>} Массив записей QR-кодов
   */
  async getQrCodesByObjectId(objectId) {
    return await this.db.qr_codes
      .where('objectId')
      .equals(objectId)
      .toArray()
  }

  /**
   * Сохраняет QR-код (добавляет новый или обновляет существующий).
   * @param {Object} qrCode - Данные QR-кода в camelCase
   * @param {string} qrCode.qrValue - Значение QR-кода
   * @param {number} qrCode.objectId - ID объекта
   * @returns {Promise<number>} ID сохранённой записи
   */
  async saveQrCode(qrCode) {
    const existing = await this.getQrCode(qrCode.qrValue)
    
    if (existing) {
      await this.db.qr_codes.update(existing.id, {
        objectId: qrCode.objectId
      })
      return existing.id
    } else {
      return await this.db.qr_codes.add({
        qrValue: qrCode.qrValue,
        objectId: qrCode.objectId
      })
    }
  }

  // ============================================================================
  // РАБОТА С ФОТОГРАФИЯМИ
  // ============================================================================

  /**
   * Получает все фотографии объекта.
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>} Массив фотографий объекта
   */
  async getPhotosByObjectId(objectId) {
    return await this.db.photos
      .where('objectId')
      .equals(objectId)
      .toArray()
  }

  /**
   * Сохраняет фотографию в кэш.
   * @param {Object} photoData - Данные фотографии в camelCase
   * @param {number} photoData.objectId - ID объекта
   * @param {string} photoData.photoMaxData - Полноразмерное фото в base64
   * @param {string} photoData.photoMinData - Миниатюра фото в base64
   * @returns {Promise<void>}
   */
  async savePhoto(photoData) {
    const photoForCache = {
      objectId: photoData.objectId,
      photoMaxData: photoData.photoMaxData,
      photoMinData: photoData.photoMinData,
      createdAt: new Date().toISOString()
    }
    
    await this.db.photos.add(photoForCache)
  }

  /**
   * Удаляет фотографию из кэша.
   * @param {number} photoId - ID фотографии
   * @returns {Promise<void>}
   */
  async deletePhoto(photoId) {
    await this.db.photos.delete(photoId)
  }

  // ============================================================================
  // РАБОТА С PROPOSED_CHANGES
  // ============================================================================

  /**
   * Кэширует массив предлагаемых изменений для МОЛа.
   * @param {Array} changes — массив записей proposed_changes
   */
  async cacheProposedChanges(changes) {
    await this.db.proposed_changes.clear()
    if (changes.length > 0) {
      const withFlags = changes.map(c => ({
        ...c,
        isDeleted: false, // задаём явно. isDeleted не входит в changes
      }))
      await this.db.proposed_changes.bulkAdd(withFlags)
    }
    console.log(`[OfflineCache] Закэшировано proposed_changes: ${changes.length}`)
  }

  /**
   * Получает все предлагаемые изменения из кэша,
   * исключая помеченные на удаление.
   * @returns {Promise<Array>}
   */
  async getProposedChanges() {
    const all = await this.db.proposed_changes.toArray()
    return all.filter(c => !c.isDeleted)
  }

  /**
   * Сохраняет предлагаемое изменение в кэш.
   * Используется пользователем без доступа к складу.
   * @param {Object} change — запись proposed_changes
   * @returns {Promise<number>} ID записи в кэше
   */
  async addProposedChange(change) {
    const record = {
      ...change,
      isDeleted: false,
      createdAt: change.createdAt || new Date().toISOString()
    }
    return await this.db.proposed_changes.add(record)
  }

  /**
   * Помечает предлагаемое изменение как удалённое.
   * МОЛ после принятия либо отклонения.
   * @param {number} id — ID записи в кэше
   */
  async markProposedChangeDeleted(id) {
    await this.db.proposed_changes.update(id, { isDeleted: true })
    console.log(`[OfflineCache] proposed_change ${id} помечен как удалённый`)
  }

  /**
   * Получает все предлагаемые изменения, помеченные на удаление.
   * Используется для удаления на сервере при синхронизации.
   * @returns {Promise<Array>}
   */
  async getDeletedProposedChanges() {
    const all = await this.db.proposed_changes.toArray()
    return all.filter(c => c.isDeleted)
  }

  /**
   * Физически удаляет запись из кэша.
   * Вызывается после успешной синхронизации удалённых записей.
   * @param {number} id — ID записи в кэше
   */
  async removeProposedChange(id) {
    await this.db.proposed_changes.delete(id)
  }

  // ============================================================================
  // РАБОТА С ЛОГАМИ
  // ============================================================================

  /**
   * Добавляет запись лога в кэш.
   * @param {string} source - Тип события
   * @param {any} content - Содержимое лога
   * @returns {Promise<void>}
   */
  async addPendingLog(source, content) {
    const logEntry = {
      source: source,
      content: content,
      time: new Date().toISOString()
    }
    
    await this.db.logs.add(logEntry)
  }

  /**
   * Получает все логи из кэша.
   * @returns {Promise<Array>}
   */
  async getAllLogs() {
    return await this.db.logs.toArray()
  }

  /**
   * Получает логи по фильтру.
   * @param {Object} filter - Объект с полями для фильтрации
   * @param {string} [filter.source] - Тип лога
   * @param {Object} [filter.content] - Поля content для фильтрации
   * @returns {Promise<Array>}
   */
  async getLogsByFilter(filter) {
    let logs = await this.db.logs.toArray()
    
    if (filter.source) {
      logs = logs.filter(log => log.source === filter.source)
    }
    
    if (filter.content) {
      logs = logs.filter(log => {
        const logContent = log.content
        if (!logContent || typeof logContent !== 'object') return false
        
        return Object.entries(filter.content).every(([key, value]) => {
          return logContent[key] === value
        })
      })
    }
    
    return logs
  }

  // ============================================================================
  // РАБОТА С ИНВЕНТАРИЗАЦИОННЫМИ КНИГАМИ (inventory_books)
  // ============================================================================

  /**
   * Получает все инвентаризационные книги из кэша.
   * @returns {Promise<Array>} Массив книг в camelCase
   */
  async getAllInventoryBooks() {
    return await this.db.inventory_books.toArray()
  }

  /**
   * Получает одну инвентаризационную книгу по ID.
   * @param {number} id - ID книги
   * @returns {Promise<Object|null>}
   */
  async getInventoryBook(id) {
    return await this.db.inventory_books.get(id)
  }

  /**
   * Получает все строки инвентаризационной книги по ID книги.
   * @param {number} bookId - ID книги
   * @returns {Promise<Array>} Массив строк книги
   */
  async getInventoryBookItems(bookId) {
    const targetId = Number(bookId)
    
    const allItems = await this.db.inventory_book_items.toArray()
    
    const filtered = allItems.filter(item => {
      return Number(item.idBook) === targetId
    })
    
    console.log(`[OfflineCache] Получено строк для книги ${bookId}: ${filtered.length}`)
    return filtered
  }

  /**
   * Находит строку инвентаризационной книги по idInventoryStatement.
   * @param {number} idInventoryStatement - ID строки инвентаризационной ведомости
   * @returns {Promise<Object|null>} Строка книги или null
   */
  async getInventoryBookItemByStatementId(idInventoryStatement) {
    return await this.db.inventory_book_items
      .where('idInventoryStatement')
      .equals(idInventoryStatement)
      .first()
  }

  /**
   * Обновляет строку инвентаризационной книги по ID.
   * @param {number} id - ID строки книги
   * @param {Object} updates - Поля для обновления
   * @returns {Promise<Object>} Обновлённая строка книги
   */
  async updateInventoryBookItem(id, updates) {
    await this.db.inventory_book_items.update(id, updates)
    return await this.db.inventory_book_items.get(id)
  }

  /**
   * Обновляет поле isActual для всех строк книги с указанным invNumber.
   * @param {number} bookId - ID книги
   * @param {string} invNumber - Инвентарный номер
   * @param {boolean} isActual - Новое значение isActual
   * @returns {Promise<void>}
   */
  async updateInventoryBookItemsActual(bookId, invNumber, isActual) {
    const targetBookId = Number(bookId)
    
    const allItems = await this.db.inventory_book_items.toArray()
    
    const itemsToUpdate = allItems.filter(item => {
      if (Number(item.idBook) !== targetBookId) return false
      if (item.invNumber !== invNumber) return false
      return true
    })
    
    if (itemsToUpdate.length === 0) {
      console.warn(`[OfflineCache] Не найдено строк для обновления: bookId=${bookId}, invNumber=${invNumber}`)
      return
    }
    
    for (const item of itemsToUpdate) {
      item.isActual = isActual
      await this.db.inventory_book_items.put(item)
    }
    
    console.log(`[OfflineCache] Обновлено ${itemsToUpdate.length} строк в книге ${bookId}: invNumber=${invNumber}, isActual=${isActual}`)
  }

  /**
   * Подтверждает наличие для указанных строк инвентаризационной книги в кэше.
   * @param {number} bookId - ID книги
   * @param {Array<number>} itemIds - ID строк для подтверждения
   * @param {Object} data - Данные подтверждения
   * @param {boolean} [data.isOkManual] - Ручное подтверждение
   * @param {boolean} [data.isOkAuto] - Автоматическое подтверждение
   * @param {string} [data.rem] - Комментарий
   * @param {number} [data.idObject] - ID объекта
   * @param {string} [data.placeTer] - Территория
   * @param {string} [data.placePos] - Здание
   * @param {string} [data.placeCab] - Кабинет
   * @param {string} [data.placeUser] - Пользователь
   * @returns {Promise<Array>} Массив обновлённых строк книги
   */
  async confirmInventoryBookItems(bookId, itemIds, data) {
    const updatedItems = []
    const now = new Date().toISOString()
    
    for (const itemId of itemIds) {
      const item = await this.db.inventory_book_items.get(itemId)
      if (!item) {
        console.warn(`[OfflineCache] Строка книги ${itemId} не найдена в кэше`)
        continue
      }
      
      if (data.idObject !== undefined) item.idObject = data.idObject
      if (data.placeTer !== undefined) item.placeTer = data.placeTer
      if (data.placePos !== undefined) item.placePos = data.placePos
      if (data.placeCab !== undefined) item.placeCab = data.placeCab
      if (data.placeUser !== undefined) item.placeUser = data.placeUser
      if (data.rem !== undefined) item.rem = data.rem
      
      if (data.isOkManual !== undefined) {
        item.isOkManual = data.isOkManual
        item.dateOkManualChecked = data.isOkManual ? now : null
      }
      
      if (data.isOkAuto !== undefined) {
        item.isOkAuto = data.isOkAuto
        item.dateOkAutoChecked = data.isOkAuto ? now : null
      }
      
      await this.db.inventory_book_items.put(item)
      updatedItems.push(item)
    }
    
    console.log(`[OfflineCache] Подтверждено ${updatedItems.length} строк в книге ${bookId}`)
    return updatedItems
  }
}

export const offlineCache = new OfflineCacheService()