import Dexie from 'dexie'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Схема базы данных (camelCase для единообразия с бэкендом)
    this.db.version(1).stores({
      // Файлы ведомостей (только массовая загрузка, без отдельных операций)
      email_attachments: 'id, filename, emailFrom, receivedAt, docType, zavod, sklad, inProcess, isInventory',
      // Объекты (есть массовая загрузка и отдельные операции add/update)
      objects: 'id, zavod, sklad, buhName, invNumber, partyNumber, sn, isWrittenOff, checkedAt, placeTer, placePos, placeCab, placeUser',
      // Объекты обрабатываемых ведомостей (только массовая загрузка, без отдельных операций)
      processed_statements: 'id, emailAttachmentId, zavod, sklad, docType, invNumber, partyNumber, buhName, haveObject, isIgnore, isExcess',
      // QR-коды (есть массовая загрузка и отдельные операции add/update)
      qr_codes: 'id, qrValue, objectId',
      // Фотографии (кэширования из БД нет, только накопление во время оффлайн-сеанса)
      photos: '++id, objectId' ,
      // Логи (кэширования из БД нет, только накопление во время оффлайн-сеанса)
      logs: '++id, source, time, content'
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
      // 1. Запрашиваем данные с бэкенда
      const response = await fetch('/api/offline/data', {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      // 2. Проверяем успешность ответа от бэкенда
      if (!result.success) {
        throw new Error(result.message || 'Бэкенд вернул ошибку')
      }
      
      // 3. Извлекаем данные
      const data = result.data
      
      if (!data) {
        throw new Error('Ответ бэкенда не содержит данных')
      }
      
      console.log('[OfflineCache] Данные получены:', {
        objects: data.objects?.length || 0,
        processed_statements: data.processed_statements?.length || 0,
        qr_codes: data.qr_codes?.length || 0,
        email_attachments: data.email_attachments?.length || 0
      })
      
      // 4. Сохраняем данные в кэш
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
      // TODO: синхронизация локальных изменений (будет добавлена позже)
      
      // Очищаем кэш
      await this.clearAllCache()
      
      console.log('[OfflineCache] Режим полёта выключен, кэш очищен')
      return { success: true, error: null }
      
    } catch (error) {
      console.error('[OfflineCache] Ошибка при выключении режима полёта:', error)
      return { success: false, error: error.message }
    }
  }

  //============================================================================
  // УПРАВЛЕНИЕ КЭШЕМ
  //============================================================================

  /**
   * Кэширует все данные для офлайн-режима
   * Предварительно очищает кэш для гарантии актуальности
   * @param {Object} data - Объект с данными от бэкенда в camelCase
   * @param {Array} data.processed_statements - Массив объектов ведомостей
   * @param {Array} data.objects - Массив объектов
   * @param {Array} data.qr_codes - Массив QR-кодов
   * @param {Array} data.email_attachments - Массив вложений
   * @returns {Promise<{success: boolean, error: string|null, stats: Object}>}
   */
  async cacheAllData(data) {
    console.log('[OfflineCache] Начинаем кэширование данных...')
    
    const {
      objects = [],
      processed_statements = [],
      qr_codes = [],
      email_attachments = []
    } = data

    try {
      // Очищаем кэш перед загрузкой новых данных
      await this.clearAllCache()
      
      let stats = {
        objects: 0,
        processed_statements: 0,
        qr_codes: 0,
        email_attachments: 0
      }
      
      // Сохраняем email_attachments (массово)
      if (email_attachments.length) {
        await this.db.email_attachments.bulkAdd(email_attachments)
        stats.email_attachments = email_attachments.length
      }
      
      // Сохраняем ведомости (массово)
      if (processed_statements.length) {
        await this.db.processed_statements.bulkAdd(processed_statements)
        stats.processed_statements = processed_statements.length
      }

      // Сохраняем объекты (массово)
      if (objects.length) {
        await this.db.objects.bulkAdd(objects)
        stats.objects = objects.length
      }
      
      // Сохраняем QR-коды (массово)
      if (qr_codes.length) {
        await this.db.qr_codes.bulkAdd(qr_codes)
        stats.qr_codes = qr_codes.length
      }
      
      console.log('[OfflineCache] Кэширование завершено:', stats)
      return { success: true, error: null, stats }
      
    } catch (error) {
      console.error('[OfflineCache] Ошибка при кэшировании:', error)
      return { success: false, error: error.message, stats: null }
    }
  }

  /**
   * Полностью очищает весь кэш
   * Вызывается при возвращении в онлайн после синхронизации и перед ручным кэшированием для гарантированной чистоты
   */
  async clearAllCache() {
    console.log('[OfflineCache] Очищаем весь кэш...')
    
    await Promise.all([
      this.db.email_attachments.clear(),
      this.db.processed_statements.clear(),
      this.db.objects.clear(),
      this.db.qr_codes.clear(),
      this.db.photos.clear(),
      this.db.logs.clear()
    ])
    
    console.log('[OfflineCache] Кэш очищен')
  }


  //============================================================================
  // РАБОТА С ФАЙЛАМИ ВЕДОМОСТЕЙ (email_attachments)
  //============================================================================

  /**
   * Получает все вложения email из кэша
   * @returns {Promise<Array>} Массив вложений в camelCase
   */
  async getAllEmailAttachments() {
    return await this.db.email_attachments.toArray()
  }

  /**
   * Получает одно вложение email по ID
   * @param {number} id - ID вложения
   * @returns {Promise<Object|null>}
   */
  async getEmailAttachment(id) {
    return await this.db.email_attachments.get(id)
  }

  //============================================================================
  // РАБОТА С ОБЪЕКТАМИ ВЕДОМОСТЕЙ (processed_statements)
  //============================================================================

  /**
   * Получает все записи ведомости по ID вложения email
   * @param {number} attachmentId - ID вложения email
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getProcessedStatementsByAttachmentId(attachmentId) {
    const targetId = Number(attachmentId)
    
    const allStatements = await this.db.processed_statements.toArray()
    
    const filtered = allStatements.filter(statement => {
      return Number(statement.emailAttachmentId) === targetId
    })
    
    console.log(`[OfflineCache] Получено записей для attachmentId ${attachmentId}: ${filtered.length}`)
    return filtered
  }

  /**
   * Обновляет поле haveObject у записи ведомости по ID
   * @param {number} statementId - ID записи ведомости
   * @param {boolean} haveObject - Новое значение haveObject
   * @returns {Promise<void>}
   */
  async updateProcessedStatementHaveObject(statementId, haveObject) {
    const targetId = Number(statementId)
    
    const statement = await this.db.processed_statements
      .where('id')
      .equals(targetId)
      .first()
    
    if (!statement) {
      throw new Error(`Запись ведомости с ID ${statementId} не найдена`)
    }
    
    statement.haveObject = haveObject
    statement.updated_at = new Date().toISOString()
    
    await this.db.processed_statements.put(statement)
    
    console.log(`[OfflineCache] Обновлена запись ${statementId}: haveObject=${haveObject}`)
  }

  /**
   * Обновляет поле isIgnore для всех записей ведомости с указанным attachmentId и invNumber
   * @param {number} attachmentId - ID вложения email
   * @param {string} invNumber - Инвентарный номер
   * @param {boolean} isIgnore - Новое значение isIgnore
   * @returns {Promise<void>}
   */
  async updateProcessedStatementsIgnoreByInv(attachmentId, invNumber, isIgnore) {
    const targetAttachmentId = Number(attachmentId)
    
    const allStatements = await this.db.processed_statements.toArray()
    
    const statementsToUpdate = allStatements.filter(statement => {
      if (Number(statement.emailAttachmentId) !== targetAttachmentId) return false
      if (statement.invNumber !== invNumber) return false
      return true
    })
    
    if (statementsToUpdate.length === 0) {
      console.warn(`[OfflineCache] Не найдено записей для обновления: attachmentId=${attachmentId}, invNumber=${invNumber}`)
      return
    }
    
    for (const statement of statementsToUpdate) {
      statement.isIgnore = isIgnore
      statement.updated_at = new Date().toISOString()
      await this.db.processed_statements.put(statement)
    }
    
    console.log(`[OfflineCache] Обновлено ${statementsToUpdate.length} записей: isIgnore=${isIgnore}`)
  }

  /**
   * Получает записи ведомости по инвентарному номеру
   * @param {string} inv - Инвентарный номер
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>} Массив записей ведомости
   */
  async getProcessedStatementsByInv(inv, zavod, sklad) {
      let statements = await this.db.processed_statements.toArray()
      
      statements = statements.filter(statement => {
        return statement.invNumber === inv
      })
      
      if (zavod !== undefined && zavod !== null) {
        const targetZavod = Number(zavod)
        statements = statements.filter(statement => {
          return Number(statement.zavod) === targetZavod
        })
      }
      
      if (sklad !== undefined && sklad !== null) {
        statements = statements.filter(statement => {
          return statement.sklad === sklad
        })
      }
      
      // Только записи без объекта — эмулирует поведение бэкенда
      statements = statements.filter(statement => {
        return statement.haveObject === false || statement.haveObject === undefined
      })
      
      console.log(`[OfflineCache] Найдено невовлечённых записей по inv=${inv}: ${statements.length}`)
      return statements
  }

  //============================================================================
  // РАБОТА С ОБЪЕКТАМИ
  //============================================================================

  /**
   * Получает объект по ID
   * @param {number} id - ID объекта
   * @returns {Promise<Object|null>}
   */
  async getObject(id) {
    return await this.db.objects.get(id)
  }

  /**
   * Добавляет новый объект
   * @param {Object} object - Данные объекта (уже подготовленные, с временным отрицательным ID)
   * @returns {Promise<number>} ID созданного объекта
   */
  async addObject(object) {
    return await this.db.objects.add(object)
  }

  /**
   * Обновляет существующий объект
   * @param {number} id - ID объекта
   * @param {Object} updates - Поля для обновления
   * @returns {Promise<Object>} Обновлённый объект
   */
  async updateObject(id, updates) {
    await this.db.objects.update(id, updates)
    return await this.getObject(id)
  }

  /**
   * Получает все объекты
   * @returns {Promise<Array>}
   */
  async getAllObjects() {
    return await this.db.objects.toArray()
  }

  /**
   * Ищет объекты по инвентарному номеру
   * @param {string} inv - Инвентарный номер
   * @param {number} [zavod] - Номер завода (опционально)
   * @param {string} [sklad] - Код склада (опционально)
   * @returns {Promise<Array>}
   */
  async findObjectsByInv(inv, zavod, sklad) {
    let collection = this.db.objects.where('invNumber').equals(inv)
    let objects = await collection.toArray()
    
    // Фильтруем по дополнительным параметрам
    if (zavod !== undefined || sklad !== undefined) {
      objects = objects.filter(obj => {
        if (zavod !== undefined && obj.zavod !== zavod) return false
        if (sklad !== undefined && obj.sklad !== sklad) return false
        return true
      })
    }
    
    return objects
  }

  //============================================================================
  // РАБОТА С QR-КОДАМИ
  //============================================================================

  /**
   * Находит QR-код по его значению
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
   * Находит все QR-коды, привязанные к объекту
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
   * Сохраняет QR-код (добавляет новый или обновляет существующий)
   * @param {Object} qrCode - Данные QR-кода в camelCase
   * @param {string} qrCode.qrValue - Значение QR-кода
   * @param {number} qrCode.objectId - ID объекта
   * @returns {Promise<number>} ID сохранённой записи
   */
  async saveQrCode(qrCode) {
    const existing = await this.getQrCode(qrCode.qrValue)
    
    if (existing) {
      // Обновляем существующую запись
      await this.db.qr_codes.update(existing.id, {
        objectId: qrCode.objectId
      })
      return existing.id
    } else {
      // Добавляем новую запись
      return await this.db.qr_codes.add({
        qrValue: qrCode.qrValue,
        objectId: qrCode.objectId
      })
    }
  }

  //============================================================================
  // РАБОТА С ФОТОГРАФИЯМИ (предварительно из БД не кэшируются, только новые из текущего оффлайн-сеанса)
  //============================================================================

  /**
   * Получает все фотографии объекта
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
   * Сохраняет фотографию в кэш
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
   * Удаляет фотографию из кэша
   * @param {number} photoId - ID фотографии
   * @returns {Promise<void>}
   */
  async deletePhoto(photoId) {
    await this.db.photos.delete(photoId)
  }

  //============================================================================
  // РАБОТА С ЛОГАМИ
  //============================================================================

  /**
   * Добавляет запись лога в кэш
   * Время создания проставляется автоматически
   * @param {string} source - Тип события (например, 'object_history', 'qr_code_history')
   * @param {any} content - Содержимое лога (объект, строка и т.д.)
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
}

export const offlineCache = new OfflineCacheService()