<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">U40TA</h1>
      
      <!-- ОБЫЧНЫЙ РЕЖИМ -->
      <div v-if="!isPending" class="telegram-btn-container">
        <p class="login-subtitle">добро пожаловать</p>
        <div ref="telegramWidget"></div>
      </div>
      
      <!-- РЕЖИМ ОЖИДАНИЯ -->
      <div v-else class="pending-state">
        <div class="pending-icon">⏳</div>
        <h2 class="pending-title">Заявка принята!</h2>
        <p class="pending-text">
          Нужно немного подождать<br>
        </p>
      </div>
      
      <!-- PWA Кнопка -->
      <PWAInstallButton />
      
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'

const BOT_USERNAME = 'u40ta_bot'

// Глобальные переменные устройства (нативный подход)
const isMobile = ref(JSON.parse(localStorage.getItem('device_isMobile') || 'false'))
const hasCamera = ref(JSON.parse(localStorage.getItem('device_hasCamera') || 'false'))

export default {
  name: 'Login',
  components: {
    PWAInstallButton
  },
  setup() {
    const router = useRouter()
    const telegramWidget = ref(null)
    const isPending = ref(false)

    const checkAuthStatus = () => {
      const pendingToken = localStorage.getItem('pending_token')
      const authToken = localStorage.getItem('auth_token')
      
      if (authToken) {
        router.push('/')
        return
      }
      
      if (pendingToken) {
        isPending.value = true
      }
    }

    const initTelegramWidget = () => {
      if (isPending.value) return
      
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', BOT_USERNAME)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-auth-url', '/api/auth/telegram')
      script.setAttribute('data-request-access', 'write')
      script.setAttribute('data-userpic', 'true')
      script.setAttribute('data-radius', '20')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.async = true

      if (telegramWidget.value) {
        telegramWidget.value.innerHTML = ''
        telegramWidget.value.appendChild(script)
      }
    }

    const onTelegramAuth = async (user) => {
      console.log('Telegram auth success:', user)

      if (!user || !user.id) {
        console.error('Invalid user data received')
        return
      }

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user)
        })

        const data = await response.json()
        console.log('Backend response:', data)

        if (data.status === 'success' && data.access_token) {
          localStorage.setItem('auth_token', data.access_token)
          router.push('/')
        } else if (data.status === 'pending') {
          localStorage.setItem('pending_token', 'true')
          isPending.value = true
        } else {
          alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'))
        }
      } catch (error) {
        console.error('Backend error:', error)
        alert('Ошибка соединения с сервером')
      }
    }

    // Функция определения устройства
    const detectDevice = async () => {
      // Проверка мобилы
      const userAgent = navigator.userAgent
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      isMobile.value = mobileRegex.test(userAgent) || ('ontouchstart' in window)
      
      // Проверка камеры
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        hasCamera.value = devices.some(device => device.kind === 'videoinput')
      } catch (error) {
        hasCamera.value = false
      }
      
      // Сохраняем в localStorage
      localStorage.setItem('device_isMobile', JSON.stringify(isMobile.value))
      localStorage.setItem('device_hasCamera', JSON.stringify(hasCamera.value))
    }

    onMounted(() => {
      checkAuthStatus()
      initTelegramWidget()
      detectDevice()
      
      window.onTelegramAuth = onTelegramAuth
    })

    return {
      isPending,
      telegramWidget
    }
  }
}
</script>

<style scoped>
@import url('/css/login.css');
</style>