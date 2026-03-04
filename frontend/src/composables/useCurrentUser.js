import { ref, computed } from 'vue'

export function useCurrentUser() {
  const userAbr = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const isFlightMode = () => localStorage.getItem('u40ta_flight_mode') === 'true'

  // Загрузка аббревиатуры пользователя
    const fetchUserAbr = async () => {
    if (isFlightMode()) {
        userAbr.value = null
        return null
    }

    isLoading.value = true
    error.value = null

    try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch('/api/users/me/abr', {
        headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
        }
        
        const data = await response.json()
        userAbr.value = data.abr || null
        return userAbr.value
    } catch (err) {
        console.error('[useCurrentUser] Ошибка получения abr:', err)
        error.value = err.message
        userAbr.value = null
        return null
    } finally {
        isLoading.value = false
    }
    }

  // Сброс при логауте
  const clearUser = () => {
    userAbr.value = null
    error.value = null
  }

  return {
    userAbr: computed(() => userAbr.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchUserAbr,
    clearUser
  }
}