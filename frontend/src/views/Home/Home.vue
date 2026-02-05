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
        <div v-if="deviceHasCamera === true" class="qr-button-wrapper">
          <QrScannerButton 
            size="large" 
            @scan="handleQrScan"
            @error="handleScanError"
          />
        </div>
        <div v-else-if="deviceHasCamera === false" class="no-camera-message">
          Камера не доступна на этом устройстве
        </div>
        <div v-else class="no-camera-message">
          Проверка доступности камеры...
        </div>
        <!-- Блок для отображения сообщений о результате сканирования -->
        <div v-if="qrScanMessage" class="qr-scan-message">
          {{ qrScanMessage }}
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
    </main>

    <footer class="home-footer">
      <PWAInstallButton />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import FlightModeToggle from './components/FlightModeToggle.vue'
import EmailAttachmentsSection from './components/EmailAttachmentsSection.vue'

const router = useRouter()

// Основные состояния компонента
const userAbr = ref('') // Аббревиатура пользователя
const hasAccessToStatements = ref(false) // Флаг доступа к ведомостям
const accessChecked = ref(false) // Флаг завершения проверки доступа
const deviceHasCamera = ref(null) // Состояние проверки камеры

// Состояния сканирования QR
const scannedQrCode = ref('') // Отсканированный QR-код
const qrScanMessage = ref('') // Сообщение о результате сканирования
const showObjectForm = ref(false) // Показать модальное окно ObjectForm
const objectFormMode = ref('edit') // Режим модального окна (edit/create)
const objectFormData = ref(null) // Данные для заполнения формы

// Оффлайн режим
const isFlightMode = ref(false)

// SSE соединение для отслеживания изменений прав доступа
const eventSource = ref(null)

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
 * Загрузка аббревиатуры пользователя
 * Вызывается при загрузке и при получении SSE событий об изменении данных пользователя
 */
const loadUserAbr = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson)
    
    const response = await fetch(`/api/users/${payload.sub}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const user = await response.json()
      userAbr.value = user.abr
      console.log('Home: аббревиатура пользователя загружена:', userAbr.value)
    }
  } catch (error) {
    console.error('Home: ошибка загрузки данных пользователя:', error)
  }
}

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
 * Проверка наличия камеры на устройстве
 * Определяет можно ли использовать QR-сканер
 */
const checkCameraAvailability = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      deviceHasCamera.value = false
      return
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    const hasCamera = devices.some(device => device.kind === 'videoinput')
    deviceHasCamera.value = hasCamera
    
    console.log('Home: наличие камеры:', deviceHasCamera.value)
  } catch (error) {
    console.error('Home: ошибка проверки камеры:', error)
    deviceHasCamera.value = false
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
    loadUserAbr() // abr мог измениться при регистрации админом
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
    loadUserAbr() // Перезагружаем аббревиатуру
  }
}

/**
 * Обработка результата сканирования QR-кода
 * Ищет объект в БД и открывает ObjectForm в режиме редактирования если найден
 */
const handleQrScan = async (qrCode) => {
  console.log('Home: получен QR-код:', qrCode)
  scannedQrCode.value = qrCode
  
  try {
    const token = localStorage.getItem('auth_token')
    
    // Ищем точное совпадение в БД
    const response = await fetch(`/api/qr-codes/scan?qr=${encodeURIComponent(qrCode)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('Результат поиска по QR:', result)
      
      if (result.success && result.object_id) {
        // QR найден, получаем данные объекта
        await loadObjectData(result.object_id)
      } else {
        // QR не найден
        qrScanMessage.value = 'QR-код не обнаружен в БД'
        showObjectForm.value = false
        
        // Автоочистка сообщения через 3 секунды
        setTimeout(() => {
          qrScanMessage.value = ''
        }, 300000)
      }
    } else {
      qrScanMessage.value = 'Ошибка сервера при поиске QR-кода'
      showObjectForm.value = false
    }
  } catch (error) {
    console.error('Home: ошибка при обработке QR-кода:', error)
    
    // Проверяем, может ли это быть ошибкой сети (оффлайн)
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      qrScanMessage.value = 'Ошибка сети. Проверьте подключение к интернету'
    } else {
      qrScanMessage.value = 'Ошибка при обработке QR-кода'
    }
    
    showObjectForm.value = false
  }
}

/**
 * Загрузка данных объекта по ID
 */
const loadObjectData = async (objectId) => {
  try {
    const token = localStorage.getItem('auth_token')
    
    // Используем существующий эндпоинт объектов
    const response = await fetch(`/api/objects/${objectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const objectData = await response.json()
      
      // Объект найден - открываем форму редактирования
      objectFormMode.value = 'edit'
      objectFormData.value = objectData
      showObjectForm.value = true
      qrScanMessage.value = '' // Очищаем сообщение
    } else {
      qrScanMessage.value = 'Объект найден, но не удалось загрузить данные'
      showObjectForm.value = false
    }
  } catch (error) {
    console.error('Home: ошибка загрузки данных объекта:', error)
    qrScanMessage.value = 'Ошибка загрузки данных объекта'
    showObjectForm.value = false
  }
}

/**
 * Обработка ошибки сканирования QR-кода
 */
const handleScanError = (error) => {
  console.log('Home: ошибка сканирования:', error)
  qrScanMessage.value = `Ошибка сканирования: ${error}`
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
  qrScanMessage.value = 'Объект успешно сохранен'
  
  // Автоматически очищаем сообщение через 3 секунды
  setTimeout(() => {
    qrScanMessage.value = ''
  }, 3000)
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
    loadUserAbr()
    
    // Проверка доступа к ведомостям
    checkAccessToStatements()
    
    // Проверка наличия камеры
    checkCameraAvailability()
    
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
  
  // Отписка от событий
  window.removeEventListener('flight-mode-changed', handleFlightModeChange)
})
</script>

<style scoped>
@import './Home.css';
</style>