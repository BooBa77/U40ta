import Dexie from 'dexie'
import { offlineCache } from './offline-cache-service'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Схема базы данных (snake_case для единообразия с бэкендом)
    this.db.version(1).stores({
      // Файлы ведомостей (только массовая загрузка, без отдельных операций)
      email_attachments: 'id, filename, email_from, received_at, doc_type, zavod, sklad, in_process, is_inventory',
      // Объекты (есть массовая загрузка и отдельные операции add/update)
      objects: 'id, zavod, sklad, buh_name, inv_number, party_number, sn, place, ter, pos, cab, user',
      // Объекты обрабатывамых ведомостей (только массовая загрузка, без отдельных операций)
      processed_statements: 'id, zavod, sklad, doc_type, inv_number, party_number, buh_name, have_object, is_ignore, is_excess',
      // QR-коды (есть массовая загрузка и отдельные операции add/update)
      qr_codes: 'id, qr_value, object_id',
      // Фотографии (кэширования из БД нет, только накопление во время оффлайн-сеанса)
      photos: '++id, object_id',
      // Логи (кэширования из БД нет, только накопление во время оффлайн-сеанса)
      logs: '++id, source, time, content'
    })
  }


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
   * @param {Object} data - Объект с данными от бэкенда
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
      
      // Сохраняем объекты (массово)
      if (objects.length) {
        await this.db.objects.bulkAdd(objects)
        stats.objects = objects.length
      }
      
      // Сохраняем ведомости (массово)
      if (processed_statements.length) {
        await this.db.processed_statements.bulkAdd(processed_statements)
        stats.processed_statements = processed_statements.length
      }
      
      // Сохраняем QR-коды (массово)
      if (qr_codes.length) {
        await this.db.qr_codes.bulkAdd(qr_codes)
        stats.qr_codes = qr_codes.length
      }
      
      // Сохраняем email_attachments (массово)
      if (email_attachments.length) {
        await this.db.email_attachments.bulkAdd(email_attachments)
        stats.email_attachments = email_attachments.length
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
 * @returns {Promise<Array>} Массив вложений
 */
async getAllEmailAttachments() {
  return await this.db.email_attachments.toArray()
}

//============================================================================
// РАБОТА С ОБЪЕКТАМИ ВЕДОМОСТЕЙ (processed_statements)
//============================================================================



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