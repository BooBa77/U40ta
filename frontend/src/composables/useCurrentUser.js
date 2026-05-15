import { ref, computed } from 'vue'

/**
 * Композабл для получения данных текущего пользователя.
 * 
 * Предоставляет реактивные свойства:
 * - userAbr — аббревиатура пользователя (инициалы)
 * - isRevisor — является ли пользователь ревизором
 * - isLoading — состояние загрузки
 * - error — сообщение об ошибке
 * 
 * Данные кешируются на время жизни приложения.
 * Обновляются через SSE-событие access-changed.
 */
export function useCurrentUser() {
  const userAbr = ref(null)
  const isRevisor = ref(false)
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Проверка активности офлайн-режима.
   */
  const isFlightMode = () => localStorage.getItem('u40ta_flight_mode') === 'true'

  /**
   * Загрузка аббревиатуры пользователя.
   * В офлайн-режиме возвращает null.
   * 
   * @returns аббревиатура или null
   */
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

  /**
   * Проверка, является ли пользователь ревизором.
   * В офлайн-режиме возвращает false.
   * 
   * @returns true если пользователь — ревизор
   */
  const fetchIsRevisor = async () => {
    if (isFlightMode()) {
      isRevisor.value = false
      return false
    }

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/users/me/is-revisor', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`)
      }
      
      const data = await response.json()
      isRevisor.value = data.isRevisor || false
      return isRevisor.value
    } catch (err) {
      console.error('[useCurrentUser] Ошибка проверки ревизора:', err)
      isRevisor.value = false
      return false
    }
  }

  /**
   * Сброс данных при логауте.
   */
  const clearUser = () => {
    userAbr.value = null
    isRevisor.value = false
    error.value = null
  }

  return {
    userAbr: computed(() => userAbr.value),
    isRevisor: computed(() => isRevisor.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchUserAbr,
    fetchIsRevisor,
    clearUser
  }
}