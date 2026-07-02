<template>
  <div class="max-w-md mx-auto mt-12 p-6 text-center bg-white rounded-lg shadow-lg">
    <h1 class="text-2xl font-bold mb-6">Вход для разработки</h1>
    
    <!-- Выпадающий список пользователей -->
    <div class="mb-4 text-left">
      <label class="block mb-2 font-medium text-gray-700">
        Выберите пользователя:
      </label>
      <select 
        v-model="selectedUserId"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      >
        <option value="">-- Выберите пользователя --</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          {{ user.label }}
        </option>
      </select>
    </div>

    <!-- Кнопка входа -->
    <BaseButton 
      @click="login" 
      :disabled="!selectedUserId" 
      variant="primary"
      class="w-full mt-4"
    >
      Войти
    </BaseButton>

    <!-- Сообщения -->
    <div v-if="error" class="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
      {{ error }}
    </div>
    <div v-if="loading" class="mt-4 p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm">
      Выполняется вход...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const selectedUserId = ref('')
const error = ref('')
const loading = ref(false)
const isProduction = import.meta.env.PROD

/**
 * Статический список пользователей для dev-режима
 * ID соответствуют реальным пользователям в базе данных
 */
const users = ref([
  { id: 1, label: 'Пользователь 1' },
  { id: 2, label: 'Пользователь 2' },
  { id: 3, label: 'Пользователь 3' },
  { id: 4, label: 'Пользователь 4' },
  { id: 5, label: 'Пользователь 5' },
  { id: 6, label: 'Пользователь 6' },
  { id: 7, label: 'Пользователь 7' },
  { id: 8, label: 'Пользователь 8' },
  { id: 9, label: 'Пользователь 9' },
  { id: 10, label: 'Пользователь 10' }
])

/**
 * Определяет тип устройства (мобильное/десктоп) и сохраняет в localStorage
 */
const detectDevice = async () => {
  const userAgent = navigator.userAgent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  const isMobile = mobileRegex.test(userAgent) || ('ontouchstart' in window)
  
  localStorage.setItem('device_isMobile', JSON.stringify(isMobile))
}

/**
 * Выполняет вход выбранного пользователя через dev-login endpoint
 * При успехе сохраняет токен и перенаправляет на главную
 */
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
})
</script>