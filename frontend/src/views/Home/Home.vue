<template>
  <div class="home-page">
    <!-- Хедер: аббревиатура и переключатель полета (если есть доступ) -->
    <header class="home-header">
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
      <FlightModeToggle v-if="hasAccessToStatements" />
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

      <!-- Панель инструментов МЦ: две кнопки в ряд -->
      <!-- Отображается ДО таблицы вложений, только при наличии доступа -->
      <div v-if="hasAccessToStatements" class="mc-tools-panel">
        <button class="mc-tool-button" @click="navigateToObjects">
          Работа с объектами
        </button>
        <button class="mc-tool-button" @click="navigateToJournal">
          Журнал
        </button>
      </div>

      <!-- Условное отображение основного функционала -->
      <template v-if="hasAccessToStatements">
        <!-- Секция почтовых вложений (с кнопкой "Проверить почту" внутри) -->
        <EmailAttachmentsSection />
      </template>
      
      <!-- Сообщение для гостей без доступа к ведомостям -->
      <div v-else-if="accessChecked" class="no-access-message">
        <p>Доступ к ведомостям отсутствует.</p>
        <p>Обратитесь к администратору для получения прав.</p>
      </div>
      
      <!-- Состояние загрузки проверки доступа -->
      <div v-else class="no-access-message">
        Проверка прав доступа...
      </div>

      <!-- Модальное окно ObjectForm для редактирования найденного объекта -->
      <ObjectFormModal
        v-if="showObjectForm"
        :is-open="showObjectForm" 
        :mode="objectFormMode"
        :initial-data="objectFormData"
        :qrCode="scannedQrCode"
        @cancel="closeObjectForm"
        @saved="handleObjectSaved"
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
    </main>

    <footer class="home-footer">
      <PWAInstallButton />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import FlightModeToggle from './components/FlightModeToggle.vue'
import EmailAttachmentsSection from './components/EmailAttachmentsSection.vue'
import { qrService } from '@/services/qr-service.js'
import { objectService } from '@/services/object-service.js'
import { useCamera } from '@/composables/useCamera.js'
import { useCurrentUser } from '@/composables/useCurrentUser'

const router = useRouter()
const route = useRoute()

// Основные состояния компонента
const hasAccessToStatements = ref(false) // Флаг доступа к ведомостям
const accessChecked = ref(false) // Флаг завершения проверки доступа
const { hasCamera } = useCamera() // Состояние камеры

// Состояния сканирования QR
const scannedQrCode = ref('') // Отсканированный QR-код
const showObjectForm = ref(false) // Показать модальное окно ObjectForm
const objectFormMode = ref('edit') // Режим модального окна (edit/create)
const objectFormData = ref(null) // Данные для заполнения формы

// Информационное модальное окно
const showInfoModal = ref(false)
const infoModalTitle = ref('')
const infoModalMessage = ref('')
let infoModalTimeout = null

// Оффлайн режим
const isFlightMode = ref(false)

// SSE соединение для отслеживания изменений прав доступа
const eventSource = ref(null)

/**
 * Показать информационное модальное окно
 */
const showInfoMessage = (title, message, autoClose = true) => {
  // Очищаем предыдущий таймер
  if (infoModalTimeout) {
    clearTimeout(infoModalTimeout)
    infoModalTimeout = null
  }
  
  infoModalTitle.value = title
  infoModalMessage.value = message
  showInfoModal.value = true
  
  // Автоматическое закрытие через 3 секунды
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
 * Перенаправляет на страницу логина если токен отсутствует
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
 * Загрузка аббревиатуры пользователя из композабла
 * Вызывается при загрузке и при получении SSE событий об изменении данных пользователя
 */
const { 
  userAbr, 
  fetchUserAbr 
} = useCurrentUser()

/**
 * Проверка доступа к ведомостям через таблицу mol_access
 * Вызывается при загрузке и при получении SSE событий access-changed
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
      console.log('Home: доступ к ведомостям:', hasAccessToStatements.value)
    }
  } catch (error) {
    console.error('Home: ошибка проверки доступа к ведомостям:', error)
    hasAccessToStatements.value = false
    accessChecked.value = true
  }
}

/**
 * Подключение к SSE потоку для отслеживания изменений прав доступа
 * Home слушает только события, связанные с изменением доступа пользователя
 */
const connectToSSE = () => {
  if (eventSource.value) {
    eventSource.value.close()
  }
  
  eventSource.value = new EventSource('/api/app-events/sse')
  
  // Обработчик входящих сообщений
  eventSource.value.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Home: получено SSE событие:', data.type)
      
      // Обработка события изменения прав доступа
      if (data.type === 'access-changed') {
        handleAccessChangedEvent(data)
      }
      
      // Можно добавить обработку других событий, специфичных для Home
      // Например, обновление данных пользователя
      if (data.type === 'user-data-updated') {
        handleUserDataUpdatedEvent(data)
      }
      
    } catch (error) {
      console.error('Home: ошибка обработки SSE события:', error)
    }
  })
  
  // Обработчик ошибок соединения
  eventSource.value.addEventListener('error', (error) => {
    console.error('Home: SSE ошибка соединения:', error)
  })
  
  console.log('Home: SSE соединение установлено для отслеживания изменений прав доступа')
}

/**
 * Обработка события изменения прав доступа
 * Проверяет, относится ли событие к текущему пользователю
 */
const handleAccessChangedEvent = (eventData) => {
  const token = localStorage.getItem('auth_token')
  const payloadBase64 = token.split('.')[1]
  const payloadJson = atob(payloadBase64)
  const payload = JSON.parse(payloadJson)
  const currentUserId = payload.sub
  
  // Если событие broadcast или для текущего пользователя
  if (!eventData.data || !eventData.data.userId || eventData.data.userId === currentUserId) {
    console.log('Home: получено событие изменения прав доступа для текущего пользователя')
    
    // Перезагружаем данные пользователя
    fetchUserAbr() // abr мог измениться при регистрации админом
    checkAccessToStatements() // доступ к ведомостям мог измениться
  }
}

/**
 * Обработка события обновления данных пользователя
 * Может приходить при изменении ФИО или других данных
 */
const handleUserDataUpdatedEvent = (eventData) => {
  const token = localStorage.getItem('auth_token')
  const payloadBase64 = token.split('.')[1]
  const payloadJson = atob(payloadBase64)
  const payload = JSON.parse(payloadJson)
  const currentUserId = payload.sub
  
  if (!eventData.data || !eventData.data.userId || eventData.data.userId === currentUserId) {
    console.log('Home: получено событие обновления данных пользователя')
    fetchUserAbr() // Перезагружаем аббревиатуру
  }
}

/**
 * Обработка результата сканирования QR-кода
 */
const handleQrScan = async (qrCode) => {
  console.log('Home: получен QR-код:', qrCode)
  scannedQrCode.value = qrCode
  
  try {
    // Используем qrService для получения кода
    const result = await qrService.findObjectIdByQrCode(qrCode)
    
    if (result && result.object_id) {
      // QR найден, получаем данные объекта
      await loadObjectData(result.object_id)
    } else {
      // QR не найден
      showInfoMessage('QR-код не найден', 'Данный QR-код не обнаружен в базе данных.')
      showObjectForm.value = false
    }
  } catch (error) {
    console.error('Home: ошибка при обработке QR-кода:', error)
    
    // qrService сам выбрасывает понятные ошибки
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
    
    // Объект найден - открываем форму редактирования
    objectFormMode.value = 'edit'
    objectFormData.value = objectData
    showObjectForm.value = true
    
  } catch (error) {
    console.error('Home: ошибка загрузки данных объекта:', error)
    showInfoMessage('Ошибка загрузки', error.message || 'Ошибка загрузки данных объекта.')
    showObjectForm.value = false
  }
}

/**
 * Обработка ошибки сканирования QR-кода
 */
const handleScanError = (error) => {
  console.log('Home: ошибка сканирования:', error)
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
  console.log('Home: объект сохранен:', savedObject)
  showObjectForm.value = false
  objectFormData.value = null
  scannedQrCode.value = ''
  showInfoMessage('Успешно', 'Объект успешно сохранен.')
}

/**
 * Навигация к работе с объектами
 */
const navigateToObjects = () => {
  console.log('Home: навигация к работе с объектами')
  // router.push('/objects') - будет реализовано позже
}

/**
 * Навигация к журналу
 */
const navigateToJournal = () => {
  console.log('Home: навигация к журналу')
  // router.push('/journal') - будет реализовано позже
}

/**
 * Обработчик изменения состояния оффлайн режима
 */
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode
  console.log('Home: состояние оффлайн режима изменено:', isFlightMode.value)
}

/**
 * Инициализация компонента
 */
onMounted(() => {
  if (checkAuth()) {
    // Загрузка данных пользователя
    fetchUserAbr()
    
    // Проверка доступа к ведомостям
    checkAccessToStatements()
    
    // Подключение к SSE для отслеживания изменений прав
    connectToSSE()
    
    // Подписка на события изменения оффлайн режима
    window.addEventListener('flight-mode-changed', handleFlightModeChange)
    
    // Синхронизация оффлайн режима между вкладками
    window.addEventListener('storage', (event) => {
      if (event.key === 'u40ta_flight_mode') {
        isFlightMode.value = JSON.parse(event.newValue || 'false')
      }
    })
    
    // ============ обработка QR параметра (при входе по ссылке из QR-кода) ============
    const qrParam = route.query.qr
    if (qrParam && typeof qrParam === 'string') {
      console.log('Home: QR параметр из URL:', qrParam)
      // Используем ту же функцию, что и при сканировании камерой
      handleQrScan(qrParam)
      
      // Очищаем query-параметр из URL
      // чтобы при обновлении страницы модалка не открывалась снова
      router.replace({ query: {} })
    }
  }
})

/**
 * Очистка ресурсов при размонтировании компонента
 */
onUnmounted(() => {
  // Закрытие SSE соединения
  if (eventSource.value) {
    eventSource.value.close()
    console.log('Home: SSE соединение закрыто')
  }
  
  // Очистка таймера модального окна
  if (infoModalTimeout) {
    clearTimeout(infoModalTimeout)
  }
  
  // Отписка от событий
  window.removeEventListener('flight-mode-changed', handleFlightModeChange)
})
</script>

<style scoped>
@import './Home.css';
</style>