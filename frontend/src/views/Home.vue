<template>
  <div class="home-page">
    <header class="home-header">
      <ExitButton />
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
    </header>

    <main class="home-main">
      <div class="actions-grid">
        <QrScannerButton 
          size="large" 
          @scan="handleScanResult"
          @error="handleScanError"
        />
        
        <DBToolsButton />

        <!-- Кнопка проверки почты -->
        <button 
          class="email-check-btn"
          @click="checkEmail"
          :disabled="checkingEmail"
        >
          {{ checkingEmail ? '📨 Проверяем...' : '📧 Проверить почту' }}
        </button>
      </div>

      <!-- Сообщение о результате проверки почты -->
      <div v-if="emailCheckMessage" class="email-check-message" :class="{ error: !emailCheckSuccess }">
        {{ emailCheckMessage }}
      </div>

      <!-- Отображение результата сканирования -->
      <div v-if="scanResult" class="scan-result">
        <h3>Результат сканирования:</h3>
        <pre>{{ scanResult }}</pre>
      </div>
      
      <!-- Отображение ошибки сканирования -->
      <div v-if="scanError" class="scan-error">
        <h3>Ошибка:</h3>
        <p>{{ scanError }}</p>
      </div>
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
import QrScannerButton from '@/components/ui/QrScannerButton.vue'
import DBToolsButton from '@/components/ui/DBToolsButton.vue'

const router = useRouter()
const userAbr = ref('')
const scanResult = ref('')
const scanError = ref('')
const checkingEmail = ref(false)
const emailCheckMessage = ref('')
const emailCheckSuccess = ref(true)

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

const checkEmail = async () => {
  if (!checkAuth()) return
  
  checkingEmail.value = true
  emailCheckMessage.value = ''
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/email/check-now', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const result = await response.json()
    
    if (result.success) {
      emailCheckMessage.value = '✅ ' + result.message
      emailCheckSuccess.value = true
    } else {
      emailCheckMessage.value = '❌ ' + result.message
      emailCheckSuccess.value = false
    }
    
  } catch (error) {
    emailCheckMessage.value = '❌ Ошибка при проверке почты'
    emailCheckSuccess.value = false
    console.error('Ошибка проверки почты:', error)
  } finally {
    checkingEmail.value = false
    
    // Автоматически скрываем сообщение через 5 секунд
    setTimeout(() => {
      emailCheckMessage.value = ''
    }, 5000)
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing);
}

.home-footer {
  margin-top: auto;
  padding-top: var(--spacing);
}

/* Стили сетки с главными кнопками */
.actions-grid {
  display: flex;
  gap: 10%;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

/* Стили для кнопки проверки почты */
.email-check-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 160px;
}

.email-check-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
}

.email-check-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
  transform: none;
}

/* Сообщение о результате проверки почты */
.email-check-message {
  padding: 12px 20px;
  border-radius: 8px;
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
}

.email-check-message.error {
  background: #ffebee;
  color: #c62828; 
  border: 1px solid #ffcdd2;
}

/* Стили для результатов сканирования */
.scan-result,
.scan-error {
  margin-top: var(--spacing);
  padding: var(--spacing);
  border-radius: 8px;
  max-width: 400px;
}

.scan-result {
  background: #e8f5e8;
  border: 1px solid #c8e6c9;
}

.scan-error {
  background: #ffebee;
  border: 1px solid #ffcdd2;
}
</style>