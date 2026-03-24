import Dexie from 'dexie'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Схема базы данных (snake_case для единообразия с бэкендом)
    this.db.version(1).stores({
      // Объекты: места теперь в корне объекта
      objects: 'id, zavod, sklad, buh_name, inv_number, party_number, sn, place, ter, pos, cab, user',
      // Обработанные ведомости
      processed_statements: 'id, zavod, sklad, doc_type, inv_number, party_number, buh_name, have_object, is_ignore, is_excess',
      // История изменений объектов (переименовано из object_changes)
      object_history: 'id, object_id, story_line, changed_at, changed_by',
      // Текущие QR-коды
      qr_codes: 'id, qr_value, object_id',
      // История перемещений QR-кодов
      qr_codes_history: '++id, old_object_id, new_object_id, changed_at',
      // Фотографии
      photos: 'id, object_id'
    })
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
   * @param {Object} object - Данные объекта
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
   * Удаляет объект
   * @param {number} id - ID объекта
   */
  async deleteObject(id) {
    await this.db.objects.delete(id)
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
   * @param {number} [zavod] - Номер завода
   * @param {string} [sklad] - Код склада
   * @returns {Promise<Array>}
   */
  async findObjectsByInv(inv, zavod, sklad) {
    let collection = this.db.objects.where('inv_number').equals(inv)
    
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
  // РАБОТА С ИСТОРИЕЙ ОБЪЕКТОВ
  //============================================================================

  /**
   * Добавляет запись в историю объекта
   * @param {Object} historyEntry - Запись истории
   * @returns {Promise<number>} ID созданной записи
   */
  async addObjectHistory(historyEntry) {
    return await this.db.object_history.add({
      ...historyEntry,
      changed_at: historyEntry.changed_at || new Date().toISOString()
    })
  }

  /**
   * Получает историю объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>}
   */
  async getObjectHistory(objectId) {
    return await this.db.object_history
      .where('object_id')
      .equals(objectId)
      .reverse()
      .sortBy('changed_at')
  }

  /**
   * Удаляет историю объекта
   * @param {number} objectId - ID объекта
   */
  async deleteObjectHistory(objectId) {
    await this.db.object_history
      .where('object_id')
      .equals(objectId)
      .delete()
  }

  //============================================================================
  // РАБОТА С QR-КОДАМИ
  //============================================================================

  /**
   * Получает QR-код по значению
   * @param {string} qrValue - Значение QR-кода
   * @returns {Promise<Object|null>}
   */
  async getQrCode(qrValue) {
    return await this.db.qr_codes
      .where('qr_value')
      .equals(qrValue)
      .first()
  }

  /**
   * Получает QR-код по ID объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Object|null>}
   */
  async getQrCodeByObjectId(objectId) {
    return await this.db.qr_codes
      .where('object_id')
      .equals(objectId)
      .first()
  }

  /**
   * Добавляет или обновляет QR-код
   * @param {Object} qrCode - Данные QR-кода
   * @returns {Promise<number>} ID
   */
  async saveQrCode(qrCode) {
    const existing = await this.getQrCode(qrCode.qr_value)
    
    if (existing) {
      // Если меняется object_id, записываем в историю
      if (existing.object_id !== qrCode.object_id) {
        await this.addQrCodeHistory({
          old_object_id: existing.object_id,
          new_object_id: qrCode.object_id,
          changed_at: new Date().toISOString()
        })
      }
      
      await this.db.qr_codes.update(existing.id, qrCode)
      return existing.id
    } else {
      return await this.db.qr_codes.add(qrCode)
    }
  }

  /**
   * Удаляет QR-код
   * @param {string} qrValue - Значение QR-кода
   */
  async deleteQrCode(qrValue) {
    const qrCode = await this.getQrCode(qrValue)
    if (qrCode) {
      await this.db.qr_codes.delete(qrCode.id)
    }
  }

  /**
   * Получает все QR-коды
   * @returns {Promise<Array>}
   */
  async getAllQrCodes() {
    return await this.db.qr_codes.toArray()
  }

  //============================================================================
  // РАБОТА С ИСТОРИЕЙ QR-КОДОВ
  //============================================================================

  /**
   * Добавляет запись в историю QR-кодов
   * @param {Object} historyEntry - Запись истории
   * @returns {Promise<number>} ID созданной записи
   */
  async addQrCodeHistory(historyEntry) {
    return await this.db.qr_codes_history.add({
      ...historyEntry,
      changed_at: historyEntry.changed_at || new Date().toISOString()
    })
  }

  /**
   * Получает историю перемещений QR-кода
   * @param {number} objectId - ID объекта (опционально)
   * @returns {Promise<Array>}
   */
  async getQrCodeHistory(objectId) {
    if (objectId) {
      // История для конкретного объекта
      return await this.db.qr_codes_history
        .where('old_object_id')
        .equals(objectId)
        .or('new_object_id')
        .equals(objectId)
        .reverse()
        .sortBy('changed_at')
    } else {
      // Вся история
      return await this.db.qr_codes_history
        .orderBy('changed_at')
        .reverse()
        .toArray()
    }
  }

  //============================================================================
  // РАБОТА С ОБРАБОТАННЫМИ ВЕДОМОСТЯМИ
  //============================================================================

  /**
   * Добавляет обработанную ведомость
   * @param {Object} statement - Данные ведомости
   * @returns {Promise<number>} ID
   */
  async addProcessedStatement(statement) {
    return await this.db.processed_statements.add(statement)
  }

  /**
   * Получает все обработанные ведомости
   * @returns {Promise<Array>}
   */
  async getAllProcessedStatements() {
    return await this.db.processed_statements.toArray()
  }

  /**
   * Получает ведомости по заводу и складу
   * @param {number} zavod - Номер завода
   * @param {string} sklad - Код склада
   * @returns {Promise<Array>}
   */
  async getProcessedStatements(zavod, sklad) {
    let collection = this.db.processed_statements
      .where('zavod')
      .equals(zavod)
    
    let statements = await collection.toArray()
    
    if (sklad) {
      statements = statements.filter(s => s.sklad === sklad)
    }
    
    return statements
  }

  /**
   * Проверяет, обработана ли ведомость
   * @param {number} zavod - Номер завода
   * @param {string} sklad - Код склада
   * @param {string} docType - Тип документа
   * @returns {Promise<boolean>}
   */
  async isStatementProcessed(zavod, sklad, docType) {
    const count = await this.db.processed_statements
      .where('[zavod+sklad+doc_type]')
      .equals([zavod, sklad, docType])
      .count()
    
    return count > 0
  }

  /**
   * Удаляет обработанную ведомость
   * @param {number} id - ID записи
   */
  async deleteProcessedStatement(id) {
    await this.db.processed_statements.delete(id)
  }

  //============================================================================
  // РАБОТА С ФОТОГРАФИЯМИ
  //============================================================================

  /**
   * Сохраняет одно фото в кэш
   * @param {Object} photo - Данные фото с сервера
   */
  async savePhoto(photo) {
    const photoForCache = {
      id: photo.id,
      object_id: photo.object_id,
      created_at: photo.created_at,
      created_by: photo.created_by,
      photo_max_data: photo.photo_max_data instanceof Buffer 
        ? new Blob([photo.photo_max_data]) 
        : photo.photo_max_data,
      photo_min_data: photo.photo_min_data instanceof Buffer 
        ? new Blob([photo.photo_min_data]) 
        : photo.photo_min_data
    }
    
    await this.db.photos.put(photoForCache)
  }

  /**
   * Получает все фото объекта
   * @param {number} objectId - ID объекта
   * @returns {Promise<Array>} Массив фото с Blob
   */
  async getPhotosByObjectId(objectId) {
    return await this.db.photos
      .where('object_id')
      .equals(objectId)
      .reverse()
      .sortBy('created_at')
  }

  /**
   * Удаляет фото из кэша
   * @param {number} id - ID фото
   */
  async deletePhoto(id) {
    await this.db.photos.delete(id)
  }


  //============================================================================
  // УПРАВЛЕНИЕ КЭШЕМ
  //============================================================================

  /**
   * Кэширует все данные для офлайн-режима
   * @param {Object} data - Объект с данными для кэширования
   * @returns {Object} Статистика по закэшированным данным
   */
  async cacheAllData(data) {
    const {
      objects = [],
      processed_statements = [],
      object_history = [],
      qr_codes = []
    } = data
    
    console.log('[OfflineCache] Начинаем кэширование данных...')
    
    // Очищаем старые данные (параллельно для скорости)
    await Promise.all([
      this.db.objects.clear(),
      this.db.processed_statements.clear(),
      this.db.object_history.clear(),
      this.db.qr_codes.clear(),
      this.db.qr_codes_history.clear() // История тоже очищается при полном кэшировании
    ])
    
    // Кэшируем новые данные (только непустые массивы)
    const results = await Promise.all([
      objects.length > 0 ? this.db.objects.bulkAdd(objects) : Promise.resolve(0),
      processed_statements.length > 0 ? this.db.processed_statements.bulkAdd(processed_statements) : Promise.resolve(0),
      object_history.length > 0 ? this.db.object_history.bulkAdd(object_history) : Promise.resolve(0),
      qr_codes.length > 0 ? this.db.qr_codes.bulkAdd(qr_codes) : Promise.resolve(0)
    ])
    
    const stats = {
      objects: objects.length,
      processed_statements: processed_statements.length,
      object_history: object_history.length,
      qr_codes: qr_codes.length
    }
    
    console.log('[OfflineCache] Данные закэшированы:', stats)
    return stats
  }

  /**
   * Получает статистику по кэшированным данным
   * @returns {Object} Количество записей в каждой таблице
   */
  async getCacheStats() {
    const [
      objectsCount,
      statementsCount,
      historyCount,
      qrCodesCount,
      qrHistoryCount
    ] = await Promise.all([
      this.db.objects.count(),
      this.db.processed_statements.count(),
      this.db.object_history.count(),
      this.db.qr_codes.count(),
      this.db.qr_codes_history.count()
    ])
    
    return {
      objects: objectsCount,
      processed_statements: statementsCount,
      object_history: historyCount,
      qr_codes: qrCodesCount,
      qr_codes_history: qrHistoryCount
    }
  }

  /**
   * Проверяет, есть ли закэшированные данные
   * @returns {boolean} True если есть кэшированные объекты
   */
  async hasCachedData() {
    const stats = await this.getCacheStats()
    return stats.objects > 0
  }

  /**
   * Полностью очищает кэш
   */
  async clearAllCache() {
    console.log('[OfflineCache] Очищаем весь кэш...')
    
    await Promise.all([
      this.db.objects.clear(),
      this.db.processed_statements.clear(),
      this.db.object_history.clear(),
      this.db.qr_codes.clear(),
      this.db.qr_codes_history.clear()
    ])
    
    console.log('[OfflineCache] Кэш очищен')
  }

  /**
   * Закрывает соединение с базой
   */
  async close() {
    this.db.close()
  }
}

// Экспортируем единственный экземпляр (синглтон)
export const offlineCache = new OfflineCacheService()