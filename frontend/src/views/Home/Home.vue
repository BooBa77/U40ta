<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Хедер -->
    <header class="flex justify-between items-center p-4 bg-white border-b border-gray-200 flex-shrink-0">
      <div v-if="userAbr" class="text-gray-700 font-medium">
        {{ userAbr }}
      </div>
      <div v-else class="w-10"></div>
      <FlightModeToggle v-if="hasAccessToStatements || isRevisor" />
    </header>
    <main class="flex-1 flex flex-col overflow-y-auto">
      <!-- Секция QR-сканирования -->
      <section class="py-5 flex justify-center flex-shrink-0">
        <div v-if="hasCamera === true" class="flex justify-center w-full">
          <div class="w-1/3 max-w-[200px] min-w-[120px]">
            <QrScannerButton 
              size="large" 
              @scan="handleQrScan"
              @error="handleScanError"
            />
          </div>
        </div>
        <div v-else-if="hasCamera === false" class="text-gray-500 text-center p-5">
          Камера не доступна на этом устройстве
        </div>
        <div v-else class="text-gray-500 text-center p-5">
          Проверка доступности камеры...
        </div>
      </section>

      <!-- Секция инвентаризационных книг (для ревизора) -->
      <InventoryBooksSection 
        v-if="showInventorySection"
        @edit-inventory-book="handleEditInventoryBook"
      />

      <!-- Секция ведомостей МОЛ -->
      <StatementsSection v-if="hasAccessToStatements" />
      
      <!-- Сообщение для гостей без доступа -->
      <div v-if="accessChecked && !hasAccessToStatements && !isRevisor" class="text-center text-gray-500 py-10 px-5">
        <p>Доступ отсутствует.</p>
        <p>Обратитесь к администратору для получения прав.</p>
      </div>
      
      <!-- Состояние загрузки проверки доступа -->
      <div v-if="!accessChecked" class="text-center text-gray-500 py-10 px-5">
        Проверка прав доступа...
      </div>

      <!-- Модальное окно ObjectForm -->
      <ObjectFormModal
        v-if="showObjectForm"
        :is-open="showObjectForm" 
        :object-id="objectFormData?.id"
        :initial-data="objectFormData"
        @cancel="closeObjectForm"
        @save="handleObjectSaved"
      />

      <!-- Модальное окно InventoryBookEditModal -->
      <InventoryBookEditModal
        :is-open="showInventoryBookEditModal"
        :book-id="editingInventoryBookId"
        @close="closeInventoryBookEditModal"
      />

      <!-- Информационное модальное окно -->
      <div v-if="showInfoModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeInfoModal">
        <div class="bg-white rounded-lg shadow-lg max-w-md w-full mx-4" @click.stop>
          <div class="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">{{ infoModalTitle }}</h3>
            <button class="text-gray-400 hover:text-gray-600 text-2xl leading-none" @click="closeInfoModal">&times;</button>
          </div>
          <div class="p-4 text-gray-600">
            {{ infoModalMessage }}
          </div>
          <div class="flex justify-end p-4 border-t border-gray-200">
            <button class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition" @click="closeInfoModal">
              Закрыть
            </button>
          </div>
        </div>
      </div>

      <!-- Нижнее меню -->
      <BottomMenu
        :is-revisor="isRevisor"
        :has-access-to-statements="hasAccessToStatements"
        :is-flight-mode="isFlightMode"
        @new-inventory="handleNewInventory"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import FlightModeToggle from './components/FlightModeToggle.vue'
import StatementsSection from './components/StatementsSection.vue'
import InventoryBooksSection from './components/InventoryBooksSection.vue'
import InventoryBookEditModal from './components/InventoryBookEditModal.vue'
import BottomMenu from './components/BottomMenu.vue'
import { qrService } from '@/services/qr.service'
import { objectService } from '@/services/object.service'
import { useCamera } from '@/composables/useCamera'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useSSE } from '@/composables/useSSE'
import { offlineCache } from '@/services/offline-cache.service'

const router = useRouter()
const route = useRoute()

// Основные состояния компонента
const hasAccessToStatements = ref(false)
const accessChecked = ref(false)
const { hasCamera } = useCamera()

// Состояния сканирования QR
const scannedQrCode = ref('')
const showObjectForm = ref(false)
const objectFormMode = ref('edit')
const objectFormData = ref(null)

// Информационное модальное окно
const showInfoModal = ref(false)
const infoModalTitle = ref('')
const infoModalMessage = ref('')
let infoModalTimeout = null

// Оффлайн режим
const isFlightMode = ref(false)
const hasInventoryBooksInCache = ref(false)

// Модалка создания/редактирования инвентаризационной книги
const showInventoryBookEditModal = ref(false)
const editingInventoryBookId = ref(null)

/**
 * Проверяет, активен ли режим полёта
 */
const checkFlightMode = () => {
  return localStorage.getItem('u40ta_flight_mode') === 'true'
}

/**
 * Показать информационное модальное окно
 */
const showInfoMessage = (title, message, autoClose = true) => {
  if (infoModalTimeout) {
    clearTimeout(infoModalTimeout)
    infoModalTimeout = null
  }
  
  infoModalTitle.value = title
  infoModalMessage.value = message
  showInfoModal.value = true
  
  if (autoClose) {
    infoModalTimeout = setTimeout(() => {
      closeInfoModal()
    }, 10000)
  }
}

/**
 * Закрыть информационное модальное окно
 */
const closeInfoModal = () => {
  showInfoModal.value = false
  infoModalTitle.value = ''
  infoModalMessage.value = ''
  
  if (infoModalTimeout) {
    clearTimeout(infoModalTimeout)
    infoModalTimeout = null
  }
}

/**
 * Проверка аутентификации пользователя
 */
const checkAuth = () => {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    router.push('/login')
    return false
  }
  return true
}

/**
 * Данные пользователя из композабла
 */
const { 
  userAbr, 
  fetchUserAbr,
  isRevisor,
  fetchIsRevisor
} = useCurrentUser()

/**
 * Проверка доступа к ведомостям
 */
const checkAccessToStatements = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/users/me/has-access-to-statements', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const data = await response.json()
      hasAccessToStatements.value = data.hasAccessToStatements
      accessChecked.value = true
    }
  } catch (error) {
    console.error('Home: ошибка проверки доступа к ведомостям:', error)
    hasAccessToStatements.value = false
    accessChecked.value = true
  }
}

/**
 * Обработчик SSE сообщений.
 * Только access-changed и user-data-updated — statement-* события больше не используются.
 */
const handleSSEMessage = (data) => {
  if (data.type === 'access-changed') {
    const token = localStorage.getItem('auth_token')
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson)
    const currentUserId = payload.sub
    
    if (!data.data || !data.data.userId || data.data.userId === currentUserId) {
      fetchUserAbr()
      checkAccessToStatements()
      fetchIsRevisor()
    }
  }
  
  if (data.type === 'user-data-updated') {
    const token = localStorage.getItem('auth_token')
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson)
    const currentUserId = payload.sub
    
    if (!data.data || !data.data.userId || data.data.userId === currentUserId) {
      fetchUserAbr()
    }
  }
}

useSSE(handleSSEMessage, { autoConnect: !checkFlightMode() })

/**
 * Обработка результата сканирования QR-кода
 */
const handleQrScan = async (qrCode) => {
  scannedQrCode.value = qrCode
  
  try {
    const result = await qrService.findObjectByQrCode(qrCode)
    
    if (result && result.objectId) {
      await loadObjectData(result.objectId)
    } else {
      showInfoMessage('QR-код не найден', 'Данный QR-код не обнаружен в базе данных.')
      showObjectForm.value = false
    }
  } catch (error) {
    console.error('Home: ошибка при обработке QR-кода:', error)
    
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      showInfoMessage('Ошибка сети', 'Проверьте подключение к интернету.')
    } else {
      showInfoMessage('Ошибка обработки', error.message || 'Ошибка при обработке QR-кода.')
    }
    
    showObjectForm.value = false
  }
}

/**
 * Загрузка данных объекта по ID
 */
const loadObjectData = async (objectId) => {
  try {
    const objectData = await objectService.getObject(objectId)
    objectFormMode.value = 'edit'
    objectFormData.value = objectData
    showObjectForm.value = true
  } catch (error) {
    console.error('[Home] ошибка загрузки данных объекта:', error)
    showInfoMessage('Ошибка загрузки', error.message || 'Ошибка загрузки данных объекта.')
    showObjectForm.value = false
  }
}

/**
 * Обработка ошибки сканирования QR-кода
 */
const handleScanError = (error) => {
  showInfoMessage('Ошибка сканирования', `Ошибка сканирования: ${error}`)
}

/**
 * Закрытие модального окна ObjectForm
 */
const closeObjectForm = () => {
  showObjectForm.value = false
  objectFormData.value = null
  scannedQrCode.value = ''
}

/**
 * Обработка сохранения объекта в ObjectForm
 */
const handleObjectSaved = (savedObject) => {
  showObjectForm.value = false
  objectFormData.value = null
  scannedQrCode.value = ''
  showInfoMessage('Успешно', 'Объект успешно сохранен.')
}

/**
 * Редактирование книги (из InventoryBooksSection)
 */
const handleEditInventoryBook = (inventoryBookId) => {
  editingInventoryBookId.value = inventoryBookId
  showInventoryBookEditModal.value = true
}

/**
 * Закрытие InventoryBookEditModal
 */
const closeInventoryBookEditModal = () => {
  showInventoryBookEditModal.value = false
  editingInventoryBookId.value = null
}

/**
 * Обработчик изменения состояния оффлайн режима
 */
const handleFlightModeChange = async (event) => {
  isFlightMode.value = event.detail.isFlightMode
  
  if (isFlightMode.value) {
    await checkInventoryBooksInCache()
  }
  
  fetchUserAbr()
  checkAccessToStatements()
  fetchIsRevisor()
}

/**
 * Проверка наличия инвентаризационных книг в кэше
 */
const checkInventoryBooksInCache = async () => {
  try {
    const inventoryBooks = await offlineCache.getAllInventoryBooks()
    hasInventoryBooksInCache.value = inventoryBooks.length > 0
  } catch (error) {
    console.error('[Home] Ошибка проверки книг в кэше:', error)
    hasInventoryBooksInCache.value = false
  }
}

/**
 * Итоговый флаг показа секции книг
 */
const showInventorySection = computed(() => {
  if (isFlightMode.value) {
    return hasInventoryBooksInCache.value
  }
  return isRevisor.value
})

// ============================================================================
// НИЖНЕЕ МЕНЮ — ОБРАБОТЧИКИ
// ============================================================================

/**
 * Кнопка "Новая инвентаризация"
 */
const handleNewInventory = () => {
  editingInventoryBookId.value = 0
  showInventoryBookEditModal.value = true
}

/**
 * Инициализация компонента
 */
onMounted(() => {
  if (checkAuth()) {
    fetchUserAbr()
    checkAccessToStatements()
    fetchIsRevisor()
    
    isFlightMode.value = checkFlightMode()

    if (isFlightMode.value) {
      checkInventoryBooksInCache()
    }

    window.addEventListener('flight-mode-changed', handleFlightModeChange)
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'u40ta_flight_mode') {
        isFlightMode.value = JSON.parse(event.newValue || 'false')
      }
    })
    
    const qrParam = route.query.qr
    if (qrParam && typeof qrParam === 'string') {
      handleQrScan(qrParam)
      router.replace({ query: {} })
    }
  }
})

/**
 * Очистка ресурсов при размонтировании компонента
 */
onUnmounted(() => {
  if (infoModalTimeout) {
    clearTimeout(infoModalTimeout)
  }
  
  window.removeEventListener('flight-mode-changed', handleFlightModeChange)
})
</script>