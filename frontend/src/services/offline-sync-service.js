/**
 * Сервис синхронизации при выходе из офлайн-режима.
 * Отвечает за подготовку changes (сравнение дат, сбор связанных сущностей)
 * и отправку их на бэкенд.
 *
 * Использует:
 * - offlineCache — для чтения данных из Dexie
 * - objectService — для запросов к API (findSimilar, getObjectFromApi)
 */
import { offlineCache } from './offline-cache-service'
import { objectService } from './object-service'

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

      // Шаг 2.2-2.4: собираем QR-коды, фото, логи
      const qrCodes = await offlineCache.getQrCodesByObjectId(objectId)
      const photos = await offlineCache.getPhotosByObjectId(objectId)
      const objectLogs = await this.getLogsByObjectId(objectId)

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
        checkedAt: object.checkedAt,
        qrCodes: qrCodes.map(qr => qr.qrValue),
        photosToAdd: photos.map(p => ({ max: p.photoMaxData, min: p.photoMinData })),
        logs: objectLogs.map(l => ({ source: l.source, time: l.time, content: l.content }))
      })
    }

    console.log(`[OfflineSyncService] Подготовлено ${changes.length} объектов для синхронизации`)
    return changes
  }

  // ============================================================================
  // ОТПРАВКА CHANGES НА БЭКЕНД
  // ============================================================================

  /**
   * Отправляет подготовленный массив changes на бэкенд.
   * @param {Array} changes — массив объектов для синхронизации
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async syncChanges(changes) {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    console.log(`[OfflineSyncService] Отправка ${changes.length} изменений на сервер...`)
    const body = { changes }
    console.log('[OfflineSyncService] Отправляем на сервер:', JSON.stringify(body, null, 2))    

    const response = await fetch(`${this.baseUrl}/offline/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ changes })
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
   * 2. Формирует changes
   * 3. Отправляет на сервер
   * 4. Возвращает результат
   * @returns {Promise<{success: boolean, syncedCount: number, message?: string}>}
   */
  async synchronize() {
    console.log('[OfflineSyncService] Начало синхронизации...')

    try {
      const changes = await this.prepareChanges()

      if (changes.length === 0) {
        console.log('[OfflineSyncService] Нет изменений для синхронизации')
        return { success: true, syncedCount: 0 }
      }

      const result = await this.syncChanges(changes)
      return { success: true, syncedCount: changes.length, ...result }
    } catch (error) {
      console.error('[OfflineSyncService] Ошибка синхронизации:', error)
      return { success: false, syncedCount: 0, message: error.message }
    }
  }
}

// Экспортируем синглтон
export const offlineSyncService = new OfflineSyncService()