import { ref, computed } from 'vue'
import { apiRequest } from '@/services/api-service'

export function useCurrentUser() {
  const userAbr = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const isFlightMode = () => localStorage.getItem('u40ta_flight_mode') === 'true'

  // Загрузка аббревиатуры пользователя
  const fetchUserAbr = async () => {
    // В офлайне null
    if (isFlightMode()) {
      userAbr.value = null
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await apiRequest('/users/me/abr')
      userAbr.value = response.abr || null
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