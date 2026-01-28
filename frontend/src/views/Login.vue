<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">U40TA</h1>
      
      <!-- ТОЛЬКО Telegram Widget -->
      <div class="telegram-btn-container">
        <p class="login-subtitle">добро пожаловать</p>
        <div ref="telegramWidget"></div>
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

export default {
  name: 'Login',
  components: {
    PWAInstallButton
  },
  setup() {
    const router = useRouter()
    const telegramWidget = ref(null)

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

        // Теперь ВСЕГДА получаем токен
        localStorage.setItem('auth_token', data.access_token)
        router.push('/') // Всегда успешный редирект
        
      } catch (error) {
        console.error('Auth error:', error)
        alert('Ошибка авторизации')
      }
    }

    onMounted(() => {
      initTelegramWidget()
      window.onTelegramAuth = onTelegramAuth
    })

    return {
      telegramWidget
    }
  }
}
</script>

<style scoped>
@import url('/css/login.css');
</style>