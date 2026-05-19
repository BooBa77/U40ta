<template>
  <div class="home-page">
    <!-- Хедер: аббревиатура и переключатель полета (если есть доступ) -->
    <header class="home-header">
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
      <FlightModeToggle v-if="hasAccessToStatements || isRevisor" />
    </header>

    <main class="home-main">
      <!-- Секция QR-сканирования - занимает центр экрана -->
      <section class="qr-scanner-section">
        <div v-if="hasCamera === true" class="qr-button-wrapper">
          <QrScannerButton 
            size="large" 
            @scan="handleQrScan"
            @error="handleScanError"
          />
        </div>
        <div v-else-if="hasCamera === false" class="no-camera-message">
          Камера не доступна на этом устройстве
        </div>
        <div v-else class="no-camera-message">
          Проверка доступности камеры...
        </div>
      </section>

      <!-- Секция инвентаризационных книг (для ревизора) -->
      <InventoryBooksSection 
        v-if="isRevisor"
        @edit-book="handleEditBook"
      />

      <!-- Секция почтовых вложений (для МОЛ) -->
      <EmailAttachmentsSection v-if="hasAccessToStatements" />
      
      <!-- Сообщение для гостей без доступа -->
      <div v-if="accessChecked && !hasAccessToStatements && !isRevisor" class="no-access-message">
        <p>Доступ отсутствует.</p>
        <p>Обратитесь к администратору для получения прав.</p>
      </div>
      
      <!-- Состояние загрузки проверки доступа -->
      <div v-if="!accessChecked" class="no-access-message">
        Проверка прав доступа...
      </div>

      <!-- Модальное окно ObjectForm для редактирования найденного объекта -->
      <ObjectFormModal
        v-if="showObjectForm"
        :is-open="showObjectForm" 
        :object-id="objectFormData?.id"
        :initial-data="objectFormData"
        @cancel="closeObjectForm"
        @save="handleObjectSaved"
      />

      <!-- Модальное окно InventoryBookEditModal (создание/редактирование книги) -->
      <InventoryBookEditModal
        :is-open="showInventoryBookEditModal"
        :book-id="editingBookId"
        @close="closeInventoryBookEditModal"
      />

      <!-- Информационное модальное окно для сообщений -->
      <div v-if="showInfoModal" class="info-modal-overlay" @click="closeInfoModal">
        <div class="info-modal-content" @click.stop>
          <div class="info-modal-header">
            <h3>{{ infoModalTitle }}</h3>
            <button class="info-modal-close" @click="closeInfoModal">&times;</button>
          </div>
          <div class="info-modal-body">
            {{ infoModalMessage }}
          </div>
          <div class="info-modal-footer">
            <button class="info-modal-button" @click="closeInfoModal">
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
        @tools="handleTools"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import FlightModeToggle from './components/FlightModeToggle.vue'
import EmailAttachmentsSection from './components/EmailAttachmentsSection.vue'
import InventoryBooksSection from './components/InventoryBooksSection.vue'
import InventoryBookEditModal from './components/InventoryBookEditModal.vue'
import BottomMenu from './components/BottomMenu.vue'
import { qrService } from '@/services/qr-service.js'
import { objectService } from '@/services/object-service.js'
import { useCamera } from '@/composables/useCamera'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useSSE } from '@/composables/useSSE'

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

// Модалка создания/редактирования инвентаризационной книги
const showInventoryBookEditModal = ref(false)
const editingBookId = ref(null)

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
 * Обработка события изменения прав доступа
 */
const handleAccessChangedEvent = (eventData) => {
  const token = localStorage.getItem('auth_token')
  const payloadBase64 = token.split('.')[1]
  const payloadJson = atob(payloadBase64)
  const payload = JSON.parse(payloadJson)
  const currentUserId = payload.sub
  
  if (!eventData.data || !eventData.data.userId || eventData.data.userId === currentUserId) {
    fetchUserAbr()
    checkAccessToStatements()
    fetchIsRevisor()
  }
}

/**
 * Обработка события обновления данных пользователя
 */
const handleUserDataUpdatedEvent = (eventData) => {
  const token = localStorage.getItem('auth_token')
  const payloadBase64 = token.split('.')[1]
  const payloadJson = atob(payloadBase64)
  const payload = JSON.parse(payloadJson)
  const currentUserId = payload.sub
  
  if (!eventData.data || !eventData.data.userId || eventData.data.userId === currentUserId) {
    fetchUserAbr()
  }
}

/**
 * Обработчик SSE сообщений
 */
const handleSSEMessage = (data) => {
  if (data.type === 'access-changed') {
    handleAccessChangedEvent(data)
  }
  
  if (data.type === 'user-data-updated') {
    handleUserDataUpdatedEvent(data)
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

// ============================================================================
// НИЖНЕЕ МЕНЮ — ОБРАБОТЧИКИ
// ============================================================================

/**
 * Кнопка "Новая инвентаризация"
 */
const handleNewInventory = () => {
  editingBookId.value = null
  showInventoryBookEditModal.value = true
}

/**
 * Кнопка "Инструменты" (МОЛ) — заглушка
 */
const handleTools = () => {
  showInfoMessage('Инструменты', 'Раздел в разработке')
}

/**
 * Редактирование книги (из InventoryBooksSection)
 */
const handleEditBook = (bookId) => {
  editingBookId.value = bookId
  showInventoryBookEditModal.value = true
}

/**
 * Закрытие InventoryBookEditModal
 */
const closeInventoryBookEditModal = () => {
  showInventoryBookEditModal.value = false
  editingBookId.value = null
}

/**
 * Обработчик изменения состояния оффлайн режима
 */
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode
  
  fetchUserAbr()
  checkAccessToStatements()
  fetchIsRevisor()
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

<style scoped>
@import './Home.css';
</style>