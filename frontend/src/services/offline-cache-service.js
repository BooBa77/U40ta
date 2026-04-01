import Dexie from 'dexie'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Схема базы данных (snake_case для единообразия с бэкендом)
    this.db.version(1).stores({
      // Объекты
      objects: 'id, zavod, sklad, buh_name, inv_number, party_number, sn, place, ter, pos, cab, user',
      // Обрабатывамые ведомости
      processed_statements: 'id, zavod, sklad, doc_type, inv_number, party_number, buh_name, have_object, is_ignore, is_excess',
      // QR-коды
      qr_codes: 'id, qr_value, object_id',
      // Фотографии
      photos: 'id, object_id',
      // Логи
      logs: '++id, source, time, content'
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
  // РАБОТА С ВЕДОМОСТЯМИ
  //============================================================================

  /**
   * Добавляет ведомость
   * @param {Object} statement - Данные ведомости
   * @returns {Promise<number>} ID
   */
  async addProcessedStatement(statement) {
    return await this.db.processed_statements.add(statement)
  }

  /**
   * Получает все ведомости
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
   * Проверяет, в работе ли ведомость
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
  // РАБОТА С ЛОГАМИ
  //============================================================================

  /**
   * Добавляет запись лога
   * @param {Object} logData - Данные лога
   * @param {string} logData.source - Источник события (например, 'object_update', 'qr_code_move')
   * @param {any} logData.content - Содержимое лога (JSON, любые данные)
   * @returns {Promise<number>} ID созданной записи
   */
  async addLog(logData) {
    return await this.db.logs.add({
      source: logData.source,
      content: logData.content,
      time: new Date().toISOString()
    })
  }

  //============================================================================
  // УПРАВЛЕНИЕ КЭШЕМ
  //============================================================================

  /**
   * Полностью очищает весь кэш
   * Вызывается при возвращении в онлайн после синхронизации
   * Также может использоваться перед ручным кэшированием для гарантированной чистоты
   */
  async clearAllCache() {
    console.log('[OfflineCache] Очищаем весь кэш...')
    
    await Promise.all([
      this.db.objects.clear(),
      this.db.processed_statements.clear(),
      this.db.qr_codes.clear(),
      this.db.photos.clear(),
      this.db.logs.clear()
    ])
    
    console.log('[OfflineCache] Кэш очищен')
  }

  /**
   * Кэширует данные для офлайн-режима
   * Вообще таблицы предварительно очищены вызовом clearAllCache() после последнего сеанса оффлайн
   * @param {Object} data - Объект с данными для кэширования
   * @returns {Object} Статистика по закэшированным данным
   */
  async cacheAllData(data) {
    const {
      objects = [],
      processed_statements = [],
      qr_codes = []
    } = data

    // Но на всякий сбойный случай очищаем кэш перед загрузкой новых данных для гарантии актуальности
    await this.clearAllCache()

    console.log('[OfflineCache] Начинаем кэширование данных...')
    
    // Кэшируем новые данные (только непустые массивы)
    const results = await Promise.all([
      objects.length > 0 ? this.db.objects.bulkAdd(objects) : Promise.resolve(0),
      processed_statements.length > 0 ? this.db.processed_statements.bulkAdd(processed_statements) : Promise.resolve(0),
      qr_codes.length > 0 ? this.db.qr_codes.bulkAdd(qr_codes) : Promise.resolve(0)
    ])
    
    const stats = {
      objects: objects.length,
      processed_statements: processed_statements.length,
      qr_codes: qr_codes.length
    }
    
    console.log('[OfflineCache] Данные закэшированы:', stats)
    return stats
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