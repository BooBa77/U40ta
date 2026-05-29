/**
 * Хук для агрегации строк инвентаризационной книги
 * 
 * Актуальные строки (isActual=true): группировка по invNumber + partyNumber + sklad
 * Неактуальные строки (isActual=false): группировка только по invNumber
 * 
 * Вычисляет статусы и цвета групп на основе подтверждений и наличия объектов в системе
 * 
 * @param {Ref<Array>} rawItems - ref с массивом сырых строк книги
 * @returns {Object} Объект с агрегированными данными и состоянием загрузки
 */
import { ref, computed, watch } from 'vue'
import { objectService } from '@/services/object-service'

export function useInventoryAggregation(rawItems) {
  const systemObjects = ref([])
  const loadingObjects = ref(false)

  /**
   * Извлекает уникальные комбинации zavod + sklad из строк книги
   * @param {Array} items - сырые строки книги
   * @returns {Array<{zavod: number, sklad: string}>}
   */
  const getUniqueLocations = (items) => {
    const locationsMap = new Map()

    for (const item of items) {
      const key = `${item.zavod}|${item.sklad}`
      if (!locationsMap.has(key)) {
        locationsMap.set(key, {
          zavod: item.zavod,
          sklad: item.sklad
        })
      }
    }

    return Array.from(locationsMap.values())
  }

  /**
   * Загружает объекты из системы для указанных складов и заводов
   * @param {Array<{zavod: number, sklad: string}>} locations - массив уникальных локаций
   * @returns {Promise<void>}
   */
  const loadSystemObjects = async (locations) => {
    if (!locations || locations.length === 0) {
      systemObjects.value = []
      return
    }

    loadingObjects.value = true

    try {
      const promises = locations.map(async ({ zavod, sklad }) => {
        try {
          const objects = await objectService.getObjectsBySklad(zavod, sklad)
          return objects || []
        } catch (err) {
          console.error(`Ошибка загрузки объектов для zavod=${zavod}, sklad=${sklad}:`, err)
          return []
        }
      })

      const results = await Promise.all(promises)
      const allObjects = results.flat()

      systemObjects.value = allObjects

      console.log(`[useInventoryAggregation] Загружено объектов в системе: ${allObjects.length}`)
    } catch (error) {
      console.error('[useInventoryAggregation] Ошибка загрузки объектов:', error)
      systemObjects.value = []
    } finally {
      loadingObjects.value = false
    }
  }

  /**
   * Генерирует ключ группировки в зависимости от статуса актуальности
   * Актуальные: invNumber + partyNumber + sklad
   * Неактуальные: только invNumber
   * @param {Object} row - строка книги
   * @returns {string} ключ для группировки
   */
  const getGroupKey = (row) => {
    const inv = row.invNumber || ''
    const isActual = row.isActual !== false

    if (!isActual) {
      return `inactive_${inv}`
    }

    const party = row.partyNumber || ''
    const sklad = row.sklad || ''
    return `active_${inv}|${party}|${sklad}`
  }

  /**
   * Проверяет, существует ли объект в системе
   * @param {Object} item - строка книги
   * @param {Map} objectsMap - Map для быстрого поиска
   * @returns {boolean}
   */
  const isFoundInSystem = (item, objectsMap) => {
    const key = `${item.invNumber}|${item.partyNumber || ''}|${item.zavod}|${item.sklad}`
    return objectsMap.has(key)
  }

  /**
   * Определяет статус группы для цветовой индикации (только для актуальных групп)
   * @param {Object} group - сгруппированные данные
   * @param {Map} objectsMap - Map объектов системы для поиска
   * @returns {'green'|'yellow'|'white'|'red'|'red-gray'}
   */
  const getGroupStatus = (group, objectsMap) => {
    const { okCount, totalCount } = group

    if (okCount === totalCount) return 'green'
    if (okCount > 0) return 'yellow'

    let foundInSystemCount = 0
    for (const item of group.items) {
      if (isFoundInSystem(item, objectsMap)) {
        foundInSystemCount++
      }
    }

    if (foundInSystemCount === totalCount) return 'white'
    if (foundInSystemCount === 0) return 'red'
    return 'red-gray'
  }

  /**
   * Возвращает цвет группы числом для CSS-класса
   * Актуальные: статус → число. Неактуальные: всегда 4 (серый)
   * @param {Object} group - сгруппированные данные
   * @returns {number} 0-белый, 1-красный, 2-жёлтый, 3-зелёный, 4-серый, 5-тёмно-красный
   */
  const getGroupColor = (group) => {
    if (!group.isActual) return 4

    const map = {
      green: 3,
      yellow: 2,
      white: 0,
      red: 1,
      'red-gray': 5
    }
    return map[group.status] ?? 4
  }

  /**
   * Форматирует отображение количества
   * @param {Object} group - сгруппированные данные
   * @param {boolean} isActive - актуальна ли группа
   * @returns {string}
   */
  const formatDisplayQuantity = (group, isActive) => {
    if (!isActive) {
      // У неактуальных всегда показываем количество
      return `(${group.totalCount} шт.)`
    }

    // У актуальных — только если больше одной
    if (group.totalCount <= 1) return ''

    const { okCount, totalCount } = group
    if (okCount > 0 && okCount < totalCount) {
      return `(${okCount}/${totalCount} шт.)`
    }
    return `(${totalCount} шт.)`
  }

  /**
   * Агрегированные строки
   */
  const aggregatedItems = computed(() => {
    const items = rawItems.value || []
    if (items.length === 0) return []

    // Создаём Map объектов системы для быстрого поиска
    const objectsMap = new Map()
    for (const obj of systemObjects.value) {
      const key = `${obj.invNumber}|${obj.partyNumber || ''}|${obj.zavod}|${obj.sklad}`
      objectsMap.set(key, obj)
    }

    // ПЕРВЫЙ ПРОХОД: Группировка
    const groupsMap = new Map()

    for (const item of items) {
      const key = getGroupKey(item)
      const haveObject = item.isOkManual || item.isOkAuto || false
      const isActual = item.isActual !== false

      if (!groupsMap.has(key)) {
        const isActiveGroup = key.startsWith('active_')

        groupsMap.set(key, {
          key,
          invNumber: item.invNumber,
          partyNumber: isActiveGroup ? (item.partyNumber || null) : null,
          sklad: isActiveGroup ? item.sklad : null,
          buhName: item.buhName,
          isActual: isActual,
          items: [],
          totalCount: 0,
          okCount: 0,
          isActiveGroup
        })
      }

      const group = groupsMap.get(key)

      group.items.push(item)
      group.totalCount++

      if (haveObject) {
        group.okCount++
      }
    }

    // ВТОРОЙ ПРОХОД: Формирование результата
    const aggregatedRows = []

    for (const group of groupsMap.values()) {
      const status = group.isActiveGroup ? getGroupStatus(group, objectsMap) : null
      const groupColor = getGroupColor({ ...group, status })

      aggregatedRows.push({
        invNumber: group.invNumber,
        partyNumber: group.partyNumber,
        buhName: group.buhName,
        sklad: group.sklad,
        totalCount: group.totalCount,
        okCount: group.okCount,
        isActual: group.isActual,
        status: status,
        groupColor: groupColor,
        displayQuantity: formatDisplayQuantity(group, group.isActiveGroup),
        showParty: group.isActiveGroup && !!group.partyNumber,
        items: group.items,
        isAggregated: true
      })
    }

    // СОРТИРОВКА: актуальные сверху, неактуальные снизу, внутри по наименованию
    return [...aggregatedRows].sort((a, b) => {
      if (a.isActual !== b.isActual) {
        return a.isActual === false ? 1 : -1
      }
      const nameA = (a.buhName || '').toLowerCase()
      const nameB = (b.buhName || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  })

  /**
   * Возвращает CSS-класс строки по цвету группы
   * @param {Object} row - агрегированная строка
   * @returns {string} CSS-класс вида row-group-{число}
   */
  const getRowClass = (row) => {
    const group = row.groupColor ?? 4
    return `row-group-${group}`
  }

  // Общий флаг загрузки
  const loading = computed(() => loadingObjects.value)

  // Следим за изменением rawItems и загружаем объекты системы
  watch(
    rawItems,
    async (newItems) => {
      if (newItems && newItems.length > 0) {
        const locations = getUniqueLocations(newItems)
        await loadSystemObjects(locations)
      } else {
        systemObjects.value = []
      }
    },
    { immediate: true, deep: false }
  )

  /**
   * Принудительная перезагрузка объектов системы
   * @returns {Promise<void>}
   */
  const reloadObjects = async () => {
    const items = rawItems.value || []
    if (items.length > 0) {
      const locations = getUniqueLocations(items)
      await loadSystemObjects(locations)
    }
  }

  return {
    aggregatedItems,
    getRowClass,
    loading,
    reloadObjects
  }
}