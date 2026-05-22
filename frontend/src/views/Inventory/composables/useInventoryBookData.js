/**
 * Хук для загрузки и группировки данных инвентаризационной книги
 */
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { inventoryBookService } from '@/services/inventory-book.service'
import { useSSE } from '@/composables/useSSE'

export function useInventoryBookData(bookId) {
  const loading = ref(true)
  const error = ref(null)
  const rawItems = ref([])
  const router = useRouter()

  /**
   * Статус группы для цветовой индикации
   * @param {Object} group — сгруппированные данные
   * @returns {'green'|'yellow'|'white'|'red'|'red-gray'}
   */
  const getGroupStatus = (group) => {
    const { okCount, totalCount, foundCount } = group

    if (okCount === totalCount) return 'green'
    if (okCount > 0) return 'yellow'
    if (foundCount === totalCount) return 'white'
    if (foundCount === 0) return 'red'
    return 'red-gray'
  }

  /**
   * Текст счётчика для ячейки
   */
  const getCounterText = (group) => {
    const { okCount, totalCount } = group
    if (okCount === totalCount) return String(okCount)
    if (okCount > 0) return `${okCount}/${totalCount}`
    return String(totalCount)
  }

  /**
   * Группирует строки по invNumber + partyNumber + sklad
   * и вычисляет статистику для каждой группы
   */
  const groupItems = (items) => {
    const groups = new Map()

    for (const item of items) {
      const key = `${item.invNumber}|${item.partyNumber || ''}|${item.sklad}`

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          invNumber: item.invNumber,
          partyNumber: item.partyNumber,
          sklad: item.sklad,
          buhName: item.buhName,
          isIgnore: item.isIgnore || false,
          items: [],
          totalCount: 0,
          okCount: 0,
          foundCount: 0,
          notFoundCount: 0,
        })
      }

      const group = groups.get(key)
      group.items.push(item)
      group.totalCount++

      if (item.isOkManual || item.isOkAuto) group.okCount++
      if (item.idObject !== null && item.idObject !== undefined) {
        group.foundCount++
      } else {
        group.notFoundCount++
      }
    }

    return Array.from(groups.values()).map(group => ({
      ...group,
      status: getGroupStatus(group),
      counterText: getCounterText(group),
    }))
  }

  const groupedItems = computed(() => groupItems(rawItems.value))

  /**
   * Загрузка строк книги
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      const items = await inventoryBookService.getBookItems(bookId)
      rawItems.value = items
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки книги'
      console.error('[useInventoryBookData] Ошибка:', err)
    } finally {
      loading.value = false
    }
  }

  const reload = () => loadData()

  // SSE
  const handleSSEMessage = (data) => {
    if (data.type === 'inventory-book-changed' && data.data?.bookId === Number(bookId)) {
      reload()
    }
  }

  const { disconnect: disconnectSSE } = useSSE(handleSSEMessage)

  loadData()

  onUnmounted(() => {
    disconnectSSE()
  })

  return {
    loading,
    error,
    rawItems,
    groupedItems,
    reload,
  }
}