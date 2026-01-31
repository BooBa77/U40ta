<template>
  <div class="home-page">
    <!-- Хедер: минималистичный, без выделений -->
    <header class="home-header">
      <!-- Аббревиатура пользователя (простой текст) -->
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
      <!-- Переключатель полета только для пользователей с доступом к ведомостям -->
      <FlightModeToggle v-if="hasAccessToStatements" />
    </header>

    <main class="home-main">
      <!-- Блок QR-сканирования или сообщения об отсутствии камеры -->
      <div class="actions-grid">
        <div v-if="deviceHasCamera === true">
          <QrScannerButton 
            size="large" 
            @scan="handleScanResult"
            @error="handleScanError"
          />
        </div>
        <div v-else-if="deviceHasCamera === false" class="no-camera-message">
          Камера не доступна на этом устройстве
        </div>
        <div v-else>
          Проверка доступности камеры...
        </div>
      </div>

      <!-- Отображение результата сканирования -->
      <div v-if="scanResult" class="scan-result">
        <h3>Результат сканирования:</h3>
        <pre>{{ scanResult }}</pre>
      </div>
      
      <div v-if="scanError" class="scan-error">
        <h3>Ошибка:</h3>
        <p>{{ scanError }}</p>
      </div>

      <!-- Условное отображение основного функционала -->
      <template v-if="hasAccessToStatements">
        <!-- Секция почтовых вложений -->
        <EmailAttachmentsSection />
        
        <!-- Панель работы с МЦ -->
        <div class="tools-panel-row">
          <!-- Кнопка 1: Работа с объектами -->
          <button class="tools-button" @click="navigateToObjects">
            Работа с объектами
          </button>
          
          <!-- Кнопка 2: Журнал -->
          <button class="tools-button" @click="navigateToJournal">
            Журнал
          </button>
        </div>
      </template>
      
      <!-- Сообщение для гостей без доступа к ведомостям -->
      <div v-else-if="accessChecked" class="no-access-message">
        <p>Доступ к ведомостям отсутствует.</p>
        <p>Обратитесь к администратору для получения прав.</p>
      </div>
      
      <div v-else class="no-access-message">
        Проверка прав доступа...
      </div>
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
import FlightModeToggle from './components/FlightModeToggle.vue'
import EmailAttachmentsSection from './components/EmailAttachmentsSection.vue'

const router = useRouter()

// Основные состояния компонента
const userAbr = ref('') // Аббревиатура пользователя (может меняться при регистрации админом)
const hasAccessToStatements = ref(false) // Флаг доступа к ведомостям (из mol_access)
const accessChecked = ref(false) // Флаг завершения проверки доступа
const deviceHasCamera = ref(null) // null-проверка не начата, true/false-результат
const isFlightMode = ref(false) // Состояние оффлайн режима (из FlightModeToggle)

// Состояния сканирования
const scanResult = ref('')
const scanError = ref('')

// SSE соединение для отслеживания изменений прав доступа
const eventSource = ref(null)

/**
 * Проверка аутентификации пользователя
 * @returns {boolean} true если пользователь авторизован
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
 * Примечание: abr может измениться, если админ зарегистрирует гостя с реальным ФИО
 */
const loadUserAbr = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    // Парсим JWT токен для получения user_id
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson)
    
    // Запрашиваем актуальные данные пользователя (включая возможные обновления abr)
    const response = await fetch(`/api/users/${payload.sub}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const user = await response.json()
      userAbr.value = user.abr
      console.log('Аббревиатура пользователя загружена:', userAbr.value)
    }
  } catch (error) {
    console.error('Ошибка загрузки данных пользователя:', error)
  }
}

/**
 * Проверка доступа к ведомостям через таблицу mol_access
 * Вызывается при загрузке и при получении SSE событий
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
      console.log('Доступ к ведомостям:', hasAccessToStatements.value)
    }
  } catch (error) {
    console.error('Ошибка проверки доступа к ведомостям:', error)
    hasAccessToStatements.value = false
    accessChecked.value = true
  }
}

/**
 * Проверка наличия камеры на устройстве
 * Использует WebRTC API для определения доступности медиаустройств
 */
const checkCameraAvailability = async () => {
  try {
    // Проверяем поддержку API
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      deviceHasCamera.value = false
      return
    }
    
    // Получаем список медиаустройств
    const devices = await navigator.mediaDevices.enumerateDevices()
    // Ищем видеовходы (камеры)
    const hasCamera = devices.some(device => device.kind === 'videoinput')
    deviceHasCamera.value = hasCamera
    
    console.log('Наличие камеры:', deviceHasCamera.value)
  } catch (error) {
    console.error('Ошибка проверки камеры:', error)
    deviceHasCamera.value = false
  }
}

/**
 * Подключение к SSE потоку для отслеживания изменений прав доступа
 * Слушает события типа 'access-changed' для динамического обновления интерфейса
 */
const connectToSSE = () => {
  // Закрываем предыдущее соединение, если есть
  if (eventSource.value) {
    eventSource.value.close()
  }
  
  // Создаем новое SSE соединение
  eventSource.value = new EventSource('/api/app-events/sse')
  
  // Обработчик входящих сообщений
  eventSource.value.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Получено SSE событие:', data.type)
      
      // Если получено событие изменения прав доступа
      if (data.type === 'access-changed') {
        // Проверяем, относится ли событие к текущему пользователю
        // Для этого нужно знать свой userId (можно получить из JWT)
        const token = localStorage.getItem('auth_token')
        const payloadBase64 = token.split('.')[1]
        const payloadJson = atob(payloadBase64)
        const payload = JSON.parse(payloadJson)
        const currentUserId = payload.sub
        
        // Если событие для текущего пользователя или broadcast
        if (!data.data || !data.data.userId || data.data.userId === currentUserId) {
          console.log('Обновление прав доступа для текущего пользователя')
          // Перезагружаем все пользовательские данные
          loadUserAbr() // abr мог измениться
          checkAccessToStatements() // доступ мог измениться
        }
      }
    } catch (error) {
      console.error('Ошибка обработки SSE события:', error)
    }
  })
  
  // Обработчик ошибок соединения
  eventSource.value.addEventListener('error', (error) => {
    console.error('SSE ошибка соединения:', error)
    // EventSource автоматически переподключится
  })
  
  console.log('SSE соединение установлено для отслеживания изменений прав доступа')
}

/**
 * Обработка результата сканирования QR-кода
 */
const handleScanResult = (result) => {
  console.log('Home.vue получил результат сканирования:', result)
  scanResult.value = result
  scanError.value = ''
}

/**
 * Обработка ошибки сканирования QR-кода
 */
const handleScanError = (error) => {
  console.log('Home.vue получил ошибку сканирования:', error)
  scanError.value = error
  scanResult.value = ''
}

/**
 * Обработчик клика по кнопке "Получить почту"
 * Вызывает ручную проверку почты (если не в оффлайн режиме)
 */
const checkEmail = () => {
  // В оффлайн режиме кнопка недоступна
  if (isFlightMode.value) return
  
  // Здесь будет вызов метода проверки почты
  // Пока просто логируем
  console.log('Запрос на получение почты')
  // В реальности нужно вызвать метод из EmailAttachmentsSection
}

/**
 * Навигация к работе с объектами
 */
const navigateToObjects = () => {
  console.log('Навигация к работе с объектами')
  // В будущем: router.push('/objects')
}

/**
 * Навигация к журналу
 */
const navigateToJournal = () => {
  console.log('Навигация к журналу')
  // В будущем: router.push('/journal')
}

/**
 * Обработчик изменения состояния оффлайн режима
 * Получает события от FlightModeToggle компонента
 */
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode
  console.log('Состояние оффлайн режима изменено:', isFlightMode.value)
}

/**
 * Инициализация компонента
 */
onMounted(() => {
  if (checkAuth()) {
    // Загружаем данные пользователя
    loadUserAbr()
    
    // Проверяем доступ к ведомостям
    checkAccessToStatements()
    
    // Проверяем наличие камеры
    checkCameraAvailability()
    
    // Подключаемся к SSE для отслеживания изменений прав
    connectToSSE()
    
    // Подписываемся на события изменения оффлайн режима
    window.addEventListener('flight-mode-changed', handleFlightModeChange)
    
    // Также слушаем события storage для синхронизации между вкладками
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
  // Закрываем SSE соединение
  if (eventSource.value) {
    eventSource.value.close()
    console.log('SSE соединение закрыто')
  }
  
  // Отписываемся от событий оффлайн режима
  window.removeEventListener('flight-mode-changed', handleFlightModeChange)
})
</script>

<style scoped>
@import './Home.css';
</style>