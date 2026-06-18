<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">U40TA</h1>
      
      <p class="login-subtitle">добро пожаловать</p>

      <!-- Кнопки входа -->
      <div class="space-y-3">
        
        <!-- Telegram -->
        <div ref="telegramWidget" class="flex justify-center"></div>

        <!-- Разделитель -->
        <div class="relative my-4">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200"></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="px-3 bg-white text-gray-400"></span>
          </div>
        </div>

        <!-- Email -->
        <button
          class="w-full py-3 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-medium
                 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          @click="openEmailModal"
        >
          Войти по email
        </button>
      </div>
      
      <!-- PWA Кнопка -->
      <PWAInstallButton />
      
    </div>

    <!-- Email модалка -->
    <EmailLoginModal
      :is-open="emailModalOpen"
      @close="emailModalOpen = false"
      @success="emailModalOpen = false"
    />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'
import EmailLoginModal from './components/EmailLoginModal.vue'

const BOT_USERNAME = 'u40ta_bot'

export default {
  name: 'Login',
  components: {
    PWAInstallButton,
    EmailLoginModal
  },
  setup() {
    const router = useRouter()
    const telegramWidget = ref(null)
    const emailModalOpen = ref(false)

    // Если уже есть токен - сразу на Home
    const authToken = localStorage.getItem('auth_token')
    if (authToken) {
      router.push('/')
    }

    const initTelegramWidget = () => {
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
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user)
        })

        const data = await response.json()

        // ВСЕГДА получаем токен
        localStorage.setItem('auth_token', data.access_token)
        // проверяем redirect
        if (!import.meta.env.DEV) {
          const urlParams = new URLSearchParams(window.location.search)
          const redirect = urlParams.get('redirect')
          
          if (redirect) {
            // Если redirect - это полный URL (начинается с http)
            if (redirect.startsWith('http')) {
              // Это наш QR-код, переходим на Home с qr параметром
              router.push({
                path: '/',
                query: { qr: redirect }
              })
              return
            } else {
              // Обычный путь
              router.push(redirect)
              return
            }
          }
        }
        
        // Нет redirect или development - на главную
        router.push('/')        
        
      } catch (error) {
        console.error('Auth error:', error)
        alert('Ошибка авторизации')
      }
    }

    const openEmailModal = () => {
      emailModalOpen.value = true
    }

    onMounted(() => {
      initTelegramWidget()
      window.onTelegramAuth = onTelegramAuth
    })

    return {
      telegramWidget,
      emailModalOpen,
      openEmailModal
    }
  }
}
</script>

<style scoped>
@import url('/css/login.css');
</style>