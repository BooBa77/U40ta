<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">Учёт МЦ ГДИ</h1>
      
      <p class="login-subtitle">добро пожаловать</p>

      <!-- Кнопки входа -->
      <div class="space-y-3">
        
        <!-- Сообщение о блокировке Telegram -->
        <div class="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p class="text-sm text-yellow-800 font-medium">
            к сожалению Telegram-авторизация
          </p>
          <p class="text-sm text-yellow-800 font-medium">
            заблокирована правительством
          </p>
          <p class="text-xs text-yellow-600 mt-1">
            Используйте вход по email
          </p>
        </div>
        <!-- Telegram 
        <div ref="telegramWidget" class="flex justify-center"></div>
        -->

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
    alert('Login.vue загружен - проверка билда')
    
    const router = useRouter()
    const telegramWidget = ref(null)
    const emailModalOpen = ref(false)
    const DEEP_LINK_STORAGE_KEY = 'deepLinkRestore'

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

        localStorage.setItem('auth_token', data.access_token)

        // Проверяем sessionStorage — есть ли deepLinkRestore
        const deepLinkStorage = getDeepLinkStorage()

        if (deepLinkStorage.redirectPath) {
          // Показываем уведомление, если оно было сохранено
          if (deepLinkStorage.notification) {
            // Уведомление покажем в DeepLink после возврата,
            // но можно алерт здесь или toast
            alert(deepLinkStorage.notification)
            delete deepLinkStorage.notification
            saveDeepLinkStorage(deepLinkStorage)
          }
          router.push(deepLinkStorage.redirectPath)
          return
        }

        // Обычная логика redirect из URL (для авторизованных маршрутов)
        if (!import.meta.env.DEV) {
          const urlParams = new URLSearchParams(window.location.search)
          const redirect = urlParams.get('redirect')
          
          if (redirect) {
            if (redirect.startsWith('http')) {
              router.push({
                path: '/',
                query: { qr: redirect, from: 'scan' }
              })
              return
            } else {
              router.push(redirect)
              return
            }
          }
        }
        
        router.push('/')
        
      } catch (error) {
        console.error('Auth error:', error)
        alert('Ошибка авторизации')
      }
    }    

    const openEmailModal = () => {
      emailModalOpen.value = true
    }

    const getDeepLinkStorage = () => {
      try {
        const raw = sessionStorage.getItem(DEEP_LINK_STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    }

    const saveDeepLinkStorage = (data) => {
      sessionStorage.setItem(DEEP_LINK_STORAGE_KEY, JSON.stringify(data))
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