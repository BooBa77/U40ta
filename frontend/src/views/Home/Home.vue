<template>
  <div class="home-page">
    <header class="home-header">
      <ExitButton />
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
      <FlightModeToggle />
    </header>

    <main class="home-main">
      <!--
      <div class="actions-grid">
        <QrScannerButton 
          size="large" 
          @scan="handleScanResult"
          @error="handleScanError"
        />
        <DBToolsButton />
      </div>
      -->

      <!-- Отображение результата -->
      <div v-if="scanResult" class="scan-result">
        <h3>Результат сканирования:</h3>
        <pre>{{ scanResult }}</pre>
      </div>
      
      <!-- Отображение ошибки -->
      <div v-if="scanError" class="scan-error">
        <h3>Ошибка:</h3>
        <p>{{ scanError }}</p>
      </div>

      <EmailAttachmentsSection />
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
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import DBToolsButton from '@/components/ui/DBToolsButton.vue'
import FlightModeToggle from './components/FlightModeToggle.vue'
import EmailAttachmentsSection from './components/EmailAttachmentsSection.vue'

const router = useRouter()
const userAbr = ref('')
const scanResult = ref('')
const scanError = ref('')

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
  console.log('Home.vue получил результат:', result)
  scanResult.value = result
  scanError.value = ''
}

const handleScanError = (error) => {
  console.log('Home.vue получил ошибку:', error)
  scanError.value = error
  scanResult.value = ''
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
  flex-direction: column;
  /* justify-content: center; */
}

.home-footer {
  margin-top: auto;
  padding-top: var(--spacing);
}

/* Стили сетки с основными кнопками */
.actions-grid {
  display: flex;
  gap: 10%; /* 20% на пустоты */
  width: 100%;
  max-width: 900px; /* ← ограничиваем общую ширину */
  margin: 0 auto; /* ← центрируем */
  justify-content: center;
  align-items: center;
}
</style>