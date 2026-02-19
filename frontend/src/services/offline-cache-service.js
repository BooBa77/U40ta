import Dexie from 'dexie'

class OfflineCacheService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Схема базы данных (snake_case для единообразия с бэкендом)
    // stores должен быть в version() или использовать dbStores
    this.db.version(1).stores({
      objects: 'id, zavod, sklad, buh_name, inv_number, party_number, sn, place, commentary',
      places: 'id, ter, pos, cab, user',
      processed_statements: 'id, zavod, sklad, doc_type, inv_number, party_number, buh_name, have_object, is_ignore, is_excess',
      object_changes: 'id, object_id, story_line, changed_at, changed_by',
      object_offline_changes: '++id, object_id, story_line, changed_at',
      qr_codes: 'id, qr_value, object_id'
    })    

    /*     // Схема базы данных (snake_case для единообразия с бэкендом)
    this.db.stores({
      objects: 'id, zavod, sklad, buh_name, inv_number, party_number, sn, place, commentary',
      places: 'id, ter, pos, cab, user',
      processed_statements: 'id, zavod, sklad, doc_type, inv_number, party_number, buh_name, have_object, is_ignore, is_excess',
      object_changes: 'id, object_id, story_line, changed_at, changed_by',
      object_offline_changes: '++id, object_id, story_line, changed_at',
      qr_codes: 'id, qr_value, object_id'
    }) */
  }
  
  /**
   * Кэширует все данные для офлайн-режима
   * @param {Object} data - Объект с данными для кэширования
   * @returns {Object} Статистика по закэшированным данным
   */
  async cacheAllData(data) {
    const {
      objects = [],
      places = [],
      processed_statements = [],
      object_changes = [],
      qr_codes = []
    } = data
    
    console.log('[OfflineCache] Начинаем кэширование данных...')
    
    // Очищаем старые данные (параллельно для скорости)
    await Promise.all([
      this.db.objects.clear(),
      this.db.places.clear(),
      this.db.processed_statements.clear(),
      this.db.object_changes.clear(),
      this.db.qr_codes.clear()
    ])
    
    // Кэшируем новые данные (только непустые массивы)
    const results = await Promise.all([
      objects.length > 0 ? this.db.objects.bulkAdd(objects) : Promise.resolve(0),
      places.length > 0 ? this.db.places.bulkAdd(places) : Promise.resolve(0),
      processed_statements.length > 0 ? this.db.processed_statements.bulkAdd(processed_statements) : Promise.resolve(0),
      object_changes.length > 0 ? this.db.object_changes.bulkAdd(object_changes) : Promise.resolve(0),
      qr_codes.length > 0 ? this.db.qr_codes.bulkAdd(qr_codes) : Promise.resolve(0)
    ])
    
    // Очищаем таблицу офлайн-изменений
    await this.db.object_offline_changes.clear()
    
    const stats = {
      objects: objects.length,
      places: places.length,
      processed_statements: processed_statements.length,
      object_changes: object_changes.length,
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
      placesCount,
      statementsCount,
      changesCount,
      qrCodesCount,
      offlineChangesCount
    ] = await Promise.all([
      this.db.objects.count(),
      this.db.places.count(),
      this.db.processed_statements.count(),
      this.db.object_changes.count(),
      this.db.qr_codes.count(),
      this.db.object_offline_changes.count()
    ])
    
    return {
      objects: objectsCount,
      places: placesCount,
      processed_statements: statementsCount,
      object_changes: changesCount,
      qr_codes: qrCodesCount,
      pending_offline_changes: offlineChangesCount
    }
  }
  
  /**
   * Проверяет, есть ли закэшированные данные
   * @returns {boolean} True если есть кэшированные объекты и места
   */
  async hasCachedData() {
    const stats = await this.getCacheStats()
    return stats.objects > 0 && stats.places > 0
  }
  
  /**
   * Полностью очищает кэш
   */
  async clearAllCache() {
    console.log('[OfflineCache] Очищаем весь кэш...')
    
    await Promise.all([
      this.db.objects.clear(),
      this.db.places.clear(),
      this.db.processed_statements.clear(),
      this.db.object_changes.clear(),
      this.db.object_offline_changes.clear(),
      this.db.qr_codes.clear()
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