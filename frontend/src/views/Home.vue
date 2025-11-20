<template>
  <div class="home-page">
    <header class="home-header">
      <ExitButton />
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
    </header>

    <main class="home-main">
      <QrScanner 
        size="large" 
        @scan="handleScanResult"
      />
    </main>

    <footer class="home-footer">
      <PWAInstallButton />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ExitButton from '@/components/ui/ExitButton.vue'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'
import QrScanner from '@/components/QrScanner.vue'

const router = useRouter()
const userAbr = ref('')

const checkAuth = () => {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    router.push('/login')
    return false
  }
  return true
}

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
    }
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error)
  }
}

const handleScanResult = (result) => {
  console.log('Home.vue получил результат сканирования:', result)
  // Здесь логика обработки результата
}

onMounted(() => {
  if (checkAuth()) {
    loadUserAbr()
  }
})
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.home-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-footer {
  margin-top: auto;
  padding-top: var(--spacing);
}
</style>