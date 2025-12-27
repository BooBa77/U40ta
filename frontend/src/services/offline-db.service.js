import Dexie from 'dexie'

class OfflineDBService {
  constructor() {
    this.db = new Dexie('u40ta_offline_db')
    
    // Версия 1 - базовая схема
    this.db.version(1).stores({
      // Основные таблицы
      objects: '++id, zavod, inv_number, party_number, place, have_object',
      
      // Очередь синхронизации
      syncQueue: '++id, table, operation, data, timestamp, synced',
      
      // Метаданные (последняя синхронизация и т.д.)
      metadata: 'key, value'
    })
    
    this.initializeMetadata()
  }
  
  // Инициализация метаданных
  async initializeMetadata() {
    const count = await this.db.metadata.count()
    if (count === 0) {
      await this.db.metadata.bulkAdd([
        { key: 'last_sync', value: null },
        { key: 'flight_mode_enabled', value: false },
        { key: 'db_version', value: '1.0' }
      ])
    }
  }
  
  // === БАЗОВЫЕ МЕТОДЫ ===
  
  // Открытие базы
  async open() {
    return this.db.open()
  }
  
  // Очистка всех данных (при выходе из режима полёта)
  async clearAll() {
    await Promise.all([
      this.db.objects.clear(),
      this.db.places.clear(),
      this.db.statements.clear(),
      this.db.syncQueue.clear()
    ])
  }
  
  // === МЕТАДАННЫЕ ===
  
  async getMetadata(key) {
    const record = await this.db.metadata.get({ key })
    return record ? record.value : null
  }
  
  async setMetadata(key, value) {
    await this.db.metadata.put({ key, value })
  }
  
  // === КЭШИРОВАНИЕ ДАННЫХ ===
  
  async cacheObjects(objects) {
    await this.db.objects.clear()
    await this.db.objects.bulkAdd(objects)
    await this.setMetadata('objects_cached_at', new Date().toISOString())
    return objects.length
  }
  
  async cachePlaces(places) {
    await this.db.places.clear()
    await this.db.places.bulkAdd(places)
    return places.length
  }
  
  async cacheStatements(statements) {
    await this.db.statements.clear()
    await this.db.statements.bulkAdd(statements)
    return statements.length
  }
  
  async cacheUser(user) {
    await this.db.users.clear()
    await this.db.users.add(user)
  }
  
  // === ПОЛУЧЕНИЕ ДАННЫХ ===
  
  async getObjects() {
    return this.db.objects.toArray()
  }
  
  async getPlaces() {
    return this.db.places.toArray()
  }
  
  async getStatements() {
    return this.db.statements.toArray()
  }
  
  async getUser() {
    return this.db.users.toArray().then(users => users[0] || null)
  }
  
  // === ОЧЕРЕДЬ СИНХРОНИЗАЦИИ ===
  
  async addToSyncQueue(table, operation, data) {
    await this.db.syncQueue.add({
      table,
      operation, // 'create', 'update', 'delete'
      data,
      timestamp: new Date().toISOString(),
      synced: false
    })
  }
  
  async getPendingSyncItems() {
    return this.db.syncQueue
      .where('synced')
      .equals(false)
      .toArray()
  }
  
  async markAsSynced(id) {
    await this.db.syncQueue.update(id, { synced: true })
  }
  
  async clearSyncedItems() {
    await this.db.syncQueue.where('synced').equals(true).delete()
  }
  
  // === ПРОВЕРКИ ===
  
  async hasCachedData() {
    const [objectsCount, placesCount] = await Promise.all([
      this.db.objects.count(),
      this.db.places.count()
    ])
    return objectsCount > 0 && placesCount > 0
  }
  
  // Закрытие базы (опционально)
  async close() {
    this.db.close()
  }
}

// Экспортируем синглтон
export const offlineDB = new OfflineDBService()