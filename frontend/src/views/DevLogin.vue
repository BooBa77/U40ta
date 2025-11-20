<template>
  <div class="dev-login">
    <h1>Вход для разработки</h1>
    
    <!-- Выпадающий список пользователей -->
    <div class="user-selection">
      <label>Выберите пользователя:</label>
      <select v-model="selectedUserId">
        <option value="">-- Выберите пользователя --</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          Пользователь #{{ user.id }}
        </option>
      </select>
    </div>

    <!-- Кнопка входа -->
    <BaseButton 
      @click="login" 
      :disabled="!selectedUserId" 
      variant="primary"
      class="login-btn"
    >
      Войти
    </BaseButton>

    <!-- Сообщения -->
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="loading">Выполняется вход...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const users = ref([])
const selectedUserId = ref('')
const error = ref('')
const loading = ref(false)
const isProduction = import.meta.env.PROD

// Функция определения устройства
const detectDevice = async () => {
  const userAgent = navigator.userAgent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  const isMobile = mobileRegex.test(userAgent) || ('ontouchstart' in window)
  
  let hasCamera = false
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    hasCamera = devices.some(device => device.kind === 'videoinput')
  } catch (error) {
    hasCamera = false
  }
  
  localStorage.setItem('device_isMobile', JSON.stringify(isMobile))
  localStorage.setItem('device_hasCamera', JSON.stringify(hasCamera))
}

// Загрузка списка пользователей
const loadUsers = async () => {
  try {
    const response = await fetch('/api/users')
    if (response.ok) {
      users.value = await response.json()
    } else {
      error.value = 'Ошибка загрузки пользователей'
    }
  } catch (err) {
    error.value = 'Ошибка соединения с сервером'
  }
}

// Вход выбранного пользователя
const login = async () => {
  if (!selectedUserId.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: parseInt(selectedUserId.value)
      })
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('auth_token', data.access_token)
      router.push('/')
    } else {
      const errorData = await response.json()
      error.value = errorData.message || 'Ошибка авторизации'
    }
  } catch (err) {
    error.value = 'Ошибка соединения с сервером'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (isProduction) {
    router.push('/login')
    return
  }
  await detectDevice()
  await loadUsers()
})
</script>

<style scoped>
.dev-login {
  max-width: 400px;
  margin: 50px auto;
  padding: var(--spacing);
  text-align: center;
  background: white;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
}

.user-selection {
  margin: var(--spacing-lg) 0;
  text-align: left;
}

.user-selection label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: 500;
  color: var(--color-text);
}

select {
  width: 100%;
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 14px;
  transition: border-color var(--transition);
}

select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-secondary);
}

.login-btn {
  width: 100%;
  margin-top: var(--spacing);
}

.error {
  margin: var(--spacing) 0;
  padding: var(--spacing-sm);
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
  border-radius: var(--border-radius);
  font-size: 14px;
}

.loading {
  margin: var(--spacing) 0;
  padding: var(--spacing-sm);
  background-color: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
  border-radius: var(--border-radius);
  font-size: 14px;
}
</style>