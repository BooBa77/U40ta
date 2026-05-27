/**
 * Хук для загрузки данных инвентаризационной книги
 * Отвечает только за получение сырых данных, без обработки и группировки
 * Группировка вынесена в useInventoryAggregation
 */
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { inventoryBookService } from '@/services/inventory-book.service'
import { useSSE } from '@/composables/useSSE'

export function useInventoryBookData(bookId) {
  const loading = ref(true)
  const error = ref(null)
  const rawItems = ref([])
  const router = useRouter()

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
    reload,
  }
}