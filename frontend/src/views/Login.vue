<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="login-title">U40TA</h1>
      <p class="login-subtitle">Временная заглушка</p>
      
      <!-- ТЕСТОВАЯ КНОПКА -->
      <button @click="testAuth" class="telegram-btn">
        🔐 Тестовая авторизация
      </button>
      
      <!-- ПРОВЕРКА БЭКЕНДА -->
      <div style="margin-top: 20px;">
        <button @click="checkBackend" style="background: #666;">
          Проверить бэкенд
        </button>
        <div v-if="backendStatus" style="margin-top: 10px; color: #4CAF50;">
          {{ backendStatus }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const backendStatus = ref('')
    
    const testAuth = async () => {
      console.log('=== ТЕСТ АВТОРИЗАЦИИ ===')
      
      const testUser = {
        id: 588376617,
        first_name: "Тест",
        last_name: "Пользователь",
        username: "testuser"
      }
      
      console.log('Тестовые данные:', testUser)
      
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testUser)
        })
        
        console.log('Статус:', response.status)
        const data = await response.json()
        console.log('Ответ:', data)
        
        if (data.status === 'success' && data.access_token) {
          localStorage.setItem('auth_token', data.access_token)
          alert('✅ Успех! Токен получен')
          router.push('/')
        } else {
          alert('❌ Ошибка: ' + (data.message || data.status))
        }
      } catch (error) {
        console.error('Ошибка:', error)
        alert('❌ Ошибка сети')
      }
    }
    
    const checkBackend = async () => {
      console.log('Проверка бэкенда...')
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        })
        backendStatus.value = `Бэкенд доступен. Статус: ${response.status}`
        console.log('Бэкенд ответил:', response.status)
      } catch (error) {
        backendStatus.value = '❌ Бэкенд недоступен'
        console.error('Бэкенд недоступен:', error)
      }
    }
    
    return {
      testAuth,
      checkBackend,
      backendStatus
    }
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.login-container {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-title {
  color: #333;
  margin-bottom: 10px;
}

.login-subtitle {
  color: #666;
  margin-bottom: 30px;
}

.telegram-btn {
  background: #0088cc;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  transition: background 0.3s;
}

.telegram-btn:hover {
  background: #006699;
}
</style>