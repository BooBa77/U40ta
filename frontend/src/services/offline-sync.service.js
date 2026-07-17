/**
 * Сервис синхронизации при выходе из офлайн-режима.
 * Отвечает за подготовку changes (сравнение дат, сбор связанных сущностей)
 * и отправку их на бэкенд.
 *
 * Использует:
 * - offlineCache — для чтения данных из Dexie
 * - objectService — для запросов к API (findSimilar, getObjectFromApi)
 */
import { offlineCache } from './offline-cache.service'
import { objectService } from './object.service'

class OfflineSyncService {
  constructor() {
    this.baseUrl = '/api'
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ЛОГАМИ В DEXIE
  // Используются только при синхронизации
  // ============================================================================

  /**
   * Получает все логи из Dexie.
   * @returns {Promise<Array>}
   */
  async getAllLogs() {
    return await offlineCache.db.logs.toArray()
  }

  /**
   * Получает логи, относящиеся к конкретному объекту.
   * Проверяет content.objectId и content.object_id.
   * @param {number} objectId — ID объекта (может быть отрицательным)
   * @returns {Promise<Array>}
   */
  async getLogsByObjectId(objectId) {
    const allLogs = await this.getAllLogs()
    return allLogs.filter(log => {
      const content = log.content
      if (!content || typeof content !== 'object') return false
      return content.objectId === objectId || content.object_id === objectId
    })
  }

  /**
   * Получает логи, относящиеся к конкретной строке инвентаризационной книги.
   * @param {number} inventoryBookItemId — idInventoryStatement
   * @returns {Promise<Array>}
   */
  async getLogsByInventoryBookItemId(inventoryBookItemId) {
    return await offlineCache.getLogsByFilter({
      source: 'inventory-history',
      content: { inventoryBookItemId }
    })
  }

  // ============================================================================
  // ФОРМИРОВАНИЕ CHANGES
  // ============================================================================

  /**
   * Подготавливает массив changes для отправки на бэкенд.
   * 1. Собирает все затронутые objectId из логов (object-history, qr-code-history, photo-history).
   * 2. Для каждого объекта проверяет даты (сравнивает с сервером).
   * 3. Собирает связанные QR-коды, фото и логи.
   * @returns {Promise<Array>} массив объектов для синхронизации
   */
  async prepareChanges() {
    console.log('[OfflineSyncService] Подготовка changes для синхронизации...')

    // Шаг 1: собираем все затронутые objectId из логов
    const allLogs = await this.getAllLogs()
    const affectedObjectIds = new Set()

    for (const log of allLogs) {
      const content = log.content
      if (!content || typeof content !== 'object') continue

      if (
        log.source === 'object-history' ||
        log.source === 'qr-code-history' ||
        log.source === 'photo-history'
      ) {
        const oid = content.objectId || content.object_id
        if (oid !== undefined && oid !== null) {
          affectedObjectIds.add(oid)
        }
      }
    }

    console.log(`[OfflineSyncService] Затронуто объектов: ${affectedObjectIds.size}`)

    const changes = []

    for (const objectId of affectedObjectIds) {
      // Шаг 2: получаем объект из кэша
      const object = await offlineCache.getObject(objectId)
      if (!object) {
        console.warn(`[OfflineSyncService] Объект ${objectId} не найден в кэше, пропускаем`)
        continue
      }

      // Определяем docType
      const docType = object.zavod === 0 ? 'ОС' : 'ОСВ'

      // Шаг 3-4: проверка дат
      const isNew = objectId < 0
      let shouldInclude = false

      if (isNew) {
        // Новый объект (отрицательный ID)
        if (!object.sn || object.sn === '-' || object.sn.trim() === '') {
          // sn пуст или "-" — сразу включаем, find-similar не вызываем
          shouldInclude = true
        } else {
          try {
            const candidates = await objectService.findSimilarObjects(
              docType, object.invNumber, object.partyNumber, object.sn
            )
            if (candidates.length === 0 || candidates.length > 1) {
              // Нет похожих или несколько — создаём новый
              shouldInclude = true
            } else {
              // Один кандидат — сравниваем даты
              const serverDate = new Date(candidates[0].checkedAt).getTime()
              const offlineDate = object.checkedAt ? new Date(object.checkedAt).getTime() : 0
              shouldInclude = offlineDate > serverDate
            }
          } catch (error) {
            console.warn(`[OfflineSyncService] Ошибка find-similar для ${objectId}:`, error.message)
            shouldInclude = true
          }
        }
      } else {
        // Существующий объект (положительный ID)
        try {
          const serverObject = await objectService.getObjectFromApi(objectId)
          const serverDate = new Date(serverObject.checkedAt).getTime()
          const offlineDate = object.checkedAt ? new Date(object.checkedAt).getTime() : 0
          shouldInclude = offlineDate > serverDate
        } catch (error) {
          // Если объект не найден на сервере — включаем (мог быть удалён)
          console.warn(`[OfflineSyncService] Объект ${objectId} не найден на сервере:`, error.message)
          shouldInclude = true
        }
      }

      if (!shouldInclude) {
        console.log(`[OfflineSyncService] Объект ${objectId} пропущен — серверная версия свежее`)
        continue
      }

      // Шаг 5: собираем QR-коды, фото, логи
      const qrCodes = await offlineCache.getQrCodesByObjectId(objectId)
      const allPhotos = await offlineCache.getPhotosByObjectId(objectId)
      const objectLogs = await this.getLogsByObjectId(objectId)

      // Разделяем фото: с id > 0 уже на сервере — в photosToUpdate (PATCH object_id)
      //                с id < 0 новые — в photosToAdd (POST)
      const photosToAdd = allPhotos
        .filter(p => !p.id || p.id < 0)
        .map(p => ({ max: p.photoMaxData, min: p.photoMinData }))

      const photosToUpdate = allPhotos
        .filter(p => p.id && p.id > 0)
        .map(p => ({ id: p.id, objectId: p.objectId }))

      changes.push({
        id: object.id,
        zavod: object.zavod,
        sklad: object.sklad,
        buhName: object.buhName,
        invNumber: object.invNumber,
        partyNumber: object.partyNumber,
        sn: object.sn,
        placeTer: object.placeTer,
        placePos: object.placePos,
        placeCab: object.placeCab,
        placeUser: object.placeUser,
        rem: object.rem,
        checkedAt: object.checkedAt,
        qrCodes: qrCodes.map(qr => qr.qrValue),
        photosToAdd,
        photosToUpdate,
        logs: objectLogs.map(l => ({ source: l.source, time: l.time, content: l.content }))
      })
    }

    console.log(`[OfflineSyncService] Подготовлено ${changes.length} объектов для синхронизации`)
    return changes
  }

  // ============================================================================
  // ФОРМИРОВАНИЕ INVENTORY BOOK ITEM CHANGES
  // ============================================================================

  /**
   * Подготавливает массив inventoryBookItemChanges для отправки на бэкенд.
   * 1. Собирает все затронутые inventoryBookItemId из логов inventory-history.
   * 2. Для каждого находит актуальное состояние в кэше.
   * 3. Собирает связанные логи.
   * @returns {Promise<Array>} массив изменений строк инвентаризационных книг
   */
  async prepareInventoryBookItemChanges() {
    console.log('[OfflineSyncService] Подготовка inventoryBookItemChanges для синхронизации...')

    // Шаг 1: собираем все затронутые inventoryBookItemId из логов
    const allLogs = await this.getAllLogs()
    const affectedItemIds = new Set()

    for (const log of allLogs) {
      if (log.source === 'inventory-history') {
        const content = log.content
        if (content && typeof content === 'object' && content.inventoryBookItemId !== undefined) {
          affectedItemIds.add(content.inventoryBookItemId)
        }
      }
    }

    if (affectedItemIds.size === 0) {
      console.log('[OfflineSyncService] Нет изменённых строк инвентаризационных книг')
      return []
    }

    console.log(`[OfflineSyncService] Затронуто строк книг: ${affectedItemIds.size}`)

    const inventoryBookItemChanges = []

    for (const idInventoryStatement of affectedItemIds) {
      // Шаг 2: получаем актуальное состояние из кэша
      const item = await offlineCache.getInventoryBookItemByStatementId(idInventoryStatement)
      if (!item) {
        console.warn(`[OfflineSyncService] Строка с idInventoryStatement=${idInventoryStatement} не найдена в кэше, пропускаем`)
        continue
      }

      // Шаг 3: собираем связанные логи
      const itemLogs = await this.getLogsByInventoryBookItemId(idInventoryStatement)

      inventoryBookItemChanges.push({
        idInventoryStatement: item.idInventoryStatement,
        idObject: item.idObject,
        placeTer: item.placeTer,
        placePos: item.placePos,
        placeCab: item.placeCab,
        placeUser: item.placeUser,
        isOkManual: item.isOkManual,
        isOkAuto: item.isOkAuto,
        dateOkManualChecked: item.dateOkManualChecked,
        dateOkAutoChecked: item.dateOkAutoChecked,
        rem: item.rem,
        logs: itemLogs.map(l => ({ source: l.source, time: l.time, content: l.content }))
      })
    }

    console.log(`[OfflineSyncService] Подготовлено ${inventoryBookItemChanges.length} строк книг для синхронизации`)
    return inventoryBookItemChanges
  }

  // ============================================================================
  // ФОРМИРОВАНИЕ PROPOSED CHANGE ACTIONS
  // ============================================================================

  /**
   * Подготавливает массив proposedChangeActions для отправки на бэкенд.
   * 
   * Смотрит на записи proposed_changes в Dexie:
   * - id < 0 (создано гостем в офлайне) → action: 'create'
   * - isDeleted === true (МОЛ принял решение в офлайне) → action: 'delete'
   * 
   * @returns {Promise<Array>} массив действий с proposed_changes
   */
  async prepareProposedChangeActions() {
    console.log('[OfflineSyncService] Подготовка proposedChangeActions для синхронизации...')

    // Получаем все записи из кэша
    const allChanges = await offlineCache.db.proposed_changes.toArray()
    
    if (allChanges.length === 0) {
      console.log('[OfflineSyncService] Нет proposed_changes для синхронизации')
      return []
    }

    const actions = []

    for (const change of allChanges) {
      if (change.id < 0 && !change.isDeleted) {
        // Гость создал в офлайне — отправляем на создание
        actions.push({
          action: 'create',
          objectId: change.objectId,
          changeType: change.changeType,
          proposedData: change.proposedData,
          userId: change.userId,
          userAbr: change.userAbr,
          objectBuhName: change.objectBuhName,
          objectInvNumber: change.objectInvNumber,
          objectSn: change.objectSn,
          photoId: change.photoId
        })
      } else if (change.isDeleted) {
        // МОЛ принял решение в офлайне — отправляем на удаление
        actions.push({
          action: 'delete',
          id: change.id,
          photoId: change.photoId
        })
      }
    }

    console.log(`[OfflineSyncService] Подготовлено ${actions.length} proposedChangeActions:`,
      `create: ${actions.filter(a => a.action === 'create').length},`,
      `delete: ${actions.filter(a => a.action === 'delete').length}`
    )
    
    return actions
  }

  // ============================================================================
  // ОТПРАВКА CHANGES НА БЭКЕНД
  // ============================================================================

  /**
   * Отправляет подготовленные изменения на бэкенд.
   * @param {Array} changes — массив объектов для синхронизации
   * @param {Array} inventoryBookItemChanges — массив изменений строк книг
   * @param {Array} proposedChangeActions — массив действий с proposed_changes
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async syncChanges(changes, inventoryBookItemChanges = [], proposedChangeActions = []) {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    console.log(`[OfflineSyncService] Отправка на сервер:`)
    console.log(`  - объектов: ${changes.length}`)
    console.log(`  - строк книг: ${inventoryBookItemChanges.length}`)
    console.log(`  - proposed_changes: ${proposedChangeActions.length}`)

    const body = { 
      changes,
      inventoryBookItemChanges,
      proposedChangeActions
    }
    
    console.log('[OfflineSyncService] Тело запроса:', JSON.stringify(body, null, 2))

    const response = await fetch(`${this.baseUrl}/offline/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Ошибка синхронизации на сервере')
    }

    console.log('[OfflineSyncService] Синхронизация успешна:', result)
    return result
  }

  // ============================================================================
  // ПОЛНЫЙ ЦИКЛ СИНХРОНИЗАЦИИ
  // ============================================================================

  /**
   * Выполняет полный цикл синхронизации при выходе из офлайна:
   * 1. Проверяет, есть ли изменения
   * 2. Формирует changes, inventoryBookItemChanges и proposedChangeActions
   * 3. Отправляет на сервер
   * 4. Возвращает результат
   * @returns {Promise<{success: boolean, syncedCount: number, message?: string}>}
   */
  async synchronize() {
    console.log('[OfflineSyncService] Начало синхронизации...')

    try {
      const changes = await this.prepareChanges()
      const inventoryBookItemChanges = await this.prepareInventoryBookItemChanges()
      const proposedChangeActions = await this.prepareProposedChangeActions()

      if (changes.length === 0 && inventoryBookItemChanges.length === 0 && proposedChangeActions.length === 0) {
        console.log('[OfflineSyncService] Нет изменений для синхронизации')
        return { success: true, syncedCount: 0 }
      }

      const result = await this.syncChanges(changes, inventoryBookItemChanges, proposedChangeActions)
      
      // После успешной синхронизации удаляем обработанные proposed_changes из кэша
      for (const action of proposedChangeActions) {
        if (action.action === 'delete' && action.id > 0) {
          await offlineCache.removeProposedChange(action.id)
        }
      }
      
      return { 
        success: true, 
        syncedCount: changes.length + inventoryBookItemChanges.length + proposedChangeActions.length, 
        ...result 
      }
    } catch (error) {
      console.error('[OfflineSyncService] Ошибка синхронизации:', error)
      return { success: false, syncedCount: 0, message: error.message }
    }
  }
}

// Экспортируем синглтон
export const offlineSyncService = new OfflineSyncService()