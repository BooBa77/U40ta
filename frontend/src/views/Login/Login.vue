<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">Учёт МЦ ГДИ</h1>
      
      <p class="login-subtitle">добро пожаловать</p>

      <!-- Кнопка входа по email -->
      <button
        class="w-full py-3 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-medium
               hover:bg-gray-50 active:bg-gray-100 transition-colors"
        @click="openEmailModal"
      >
        Войти по email
      </button>
      
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'
import EmailLoginModal from './components/EmailLoginModal.vue'

export default {
  name: 'Login',
  components: {
    PWAInstallButton,
    EmailLoginModal
  },
  setup() {
    const router = useRouter()
    const emailModalOpen = ref(false)

    // Если уже есть токен - сразу на Home
    const authToken = localStorage.getItem('auth_token')
    if (authToken) {
      router.push('/')
    }

    const openEmailModal = () => {
      emailModalOpen.value = true
    }

    return {
      emailModalOpen,
      openEmailModal
    }
  }
}
</script>

<style scoped>
@import url('/css/login.css');
</style>