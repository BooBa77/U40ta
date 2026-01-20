<template>
  <div v-if="showInstallButton" class="pwa-section">
    <p class="pwa-status">Для удобства рекомендуем</p>
    <BaseButton 
      variant="secondary"
      @click="installPWA"
      class="install-btn"
    >
      Установить PWA приложение
    </BaseButton>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import BaseButton from './BaseButton.vue'

// Константа для ключа Flight Mode в localStorage (должна совпадать с другими компонентами)
const FLIGHT_MODE_KEY = 'u40ta_flight_mode';

// Состояния компонента
const showInstallButton = ref(false)
const deferredPrompt = ref(null)
const isOnline = ref(navigator.onLine)
const isFlightMode = ref(false) // Состояние нашего кастомного Flight Mode

// Обновление статуса онлайн/оффлайн (браузерное соединение)
const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine
  // Скрываем кнопку если нет интернета ИЛИ включен Flight Mode
  if (!isOnline.value || isFlightMode.value) {
    showInstallButton.value = false
  }
}

// Обработчик изменения состояния Flight Mode
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode
  console.log('PWAInstallButton: Flight Mode изменён:', isFlightMode.value)
  
  // Если включен Flight Mode - скрываем кнопку установки
  if (isFlightMode.value) {
    showInstallButton.value = false
  } else if (isOnline.value) {
    // Если выключен Flight Mode и есть интернет - проверяем возможность установки
    checkInstallAvailability()
  }
}

// Инициализация состояния Flight Mode из localStorage
const initFlightMode = () => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY)
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved)
    console.log('PWAInstallButton: Flight Mode инициализирован:', isFlightMode.value)
  }
}

// Проверка возможности установки PWA
const checkInstallAvailability = () => {
  // Не показывать кнопку если: нет интернета, Flight Mode включен, или уже установлено как PWA
  if (!isOnline.value || isFlightMode.value || window.matchMedia('(display-mode: standalone)').matches) {
    showInstallButton.value = false
    return
  }
  
  // Если уже есть отложенный prompt - показываем кнопку
  if (deferredPrompt.value) {
    showInstallButton.value = true
  }
}

// Инициализация PWA установки
const initPWA = () => {
  // Не инициализируем если нет интернета или включен Flight Mode
  if (!isOnline.value || isFlightMode.value) return
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    
    // Проверяем все условия перед показом кнопки
    checkInstallAvailability()
  })

  window.addEventListener('appinstalled', () => {
    showInstallButton.value = false
    deferredPrompt.value = null
    console.log('PWAInstallButton: Приложение установлено')
  })
}

// Установка PWA приложения
const installPWA = () => {
  // Проверяем все условия: есть prompt, есть интернет, НЕ Flight Mode
  if (deferredPrompt.value && isOnline.value && !isFlightMode.value) {
    deferredPrompt.value.prompt()
    deferredPrompt.value.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showInstallButton.value = false
        console.log('PWAInstallButton: Пользователь принял установку')
      } else {
        console.log('PWAInstallButton: Пользователь отклонил установку')
      }
      deferredPrompt.value = null
    })
  } else {
    console.log('PWAInstallButton: Установка невозможна - проверьте интернет или режим полёта')
  }
}

// При монтировании компонента
onMounted(() => {
  // Инициализируем Flight Mode из localStorage
  initFlightMode()
  
  // Слушаем события онлайн/оффлайн браузера
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  // Слушаем события изменения Flight Mode от других компонентов
  window.addEventListener('flight-mode-changed', handleFlightModeChange)
  
  // Также слушаем события storage для синхронизации между вкладками
  window.addEventListener('storage', (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      isFlightMode.value = JSON.parse(event.newValue || 'false')
      console.log('PWAInstallButton: Flight Mode синхронизирован через storage')
      checkInstallAvailability()
    }
  })
  
  // Инициализируем PWA логику
  initPWA()
  
  // Первоначальная проверка доступности
  checkInstallAvailability()
  
  console.log('PWAInstallButton смонтирован')
})

// При размонтировании компонента
onUnmounted(() => {
  // Убираем все слушатели событий
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
  window.removeEventListener('flight-mode-changed', handleFlightModeChange)
  
  console.log('PWAInstallButton размонтирован')
})
</script>

<style scoped>
.pwa-section {
  text-align: center;
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing);
  border-top: 1px solid var(--border-color);
}

.pwa-status {
  font-size: 14px;
  color: #666;
  margin-bottom: var(--spacing-sm);
}

.install-btn {
  width: 100%;
  max-width: 300px;
}
</style>