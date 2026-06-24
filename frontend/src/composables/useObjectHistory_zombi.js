/**
 * Композабл для работы с историей изменений объектов
 * Загрузка и отображение истории, добавление комментариев
 */
import { ref } from 'vue'
import { historyService } from '@/services/HistoryService.js'

export function useObjectHistory(objectId = null) {
  const history = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Загружает историю изменений объекта
   */
  const loadHistory = async (targetObjectId = objectId) => {
    if (!targetObjectId) {
      history.value = []
      return
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // TODO: Заменить на реальный API-вызов
      history.value = await historyService.getObjectHistory(targetObjectId)
    } catch (err) {
      error.value = `Ошибка загрузки истории: ${err.message}`
      console.error('Ошибка загрузки истории:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Добавляет запись в историю (комментарий или действие)
   */
  const addHistoryRecord = async (action, comment = null, targetObjectId = objectId) => {
    if (!targetObjectId) {
      error.value = 'Не указан объект'
      return false
    }
    
    if (!action?.trim()) {
      error.value = 'Не указано действие'
      return false
    }
    
    try {
      // TODO: Реальное сохранение через API
      const userId = localStorage.getItem('user_id') || 'system'
      const userName = localStorage.getItem('user_name') || 'Пользователь'
      
      const newRecord = {
        id: Date.now(),
        object_id: targetObjectId,
        user_id: userId,
        user_name: userName,
        action: action,
        comment: comment,
        created_at: new Date().toISOString()
      }
      
      // Сохраняем через сервис
      await historyService.addHistoryRecord(newRecord)
      
      // Добавляем в локальный список
      history.value.unshift(newRecord)
      
      return true
    } catch (err) {
      error.value = `Ошибка сохранения истории: ${err.message}`
      console.error('Ошибка сохранения истории:', err)
      return false
    }
  }

  return {
    history,
    isLoading,
    error,
    loadHistory,
    addHistoryRecord
  }
}