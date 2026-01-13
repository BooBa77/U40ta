/**
 * Хук для загрузки данных ведомости
 * Версия 1: минимальная - только загрузка, без группировки и сортировки
 * @param {string|number} attachmentId - ID вложения email
 * @returns {Object} Состояния и методы для работы с данными ведомости
 */
import { ref } from 'vue'
import { statementService } from '../services/statement.service'

export function useStatementData(attachmentId) {
  // Состояния
  const loading = ref(true)
  const error = ref(null)
  const statements = ref([])

  /**
   * Загружает данные ведомости
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      const data = await statementService.fetchStatement(attachmentId)
      statements.value = data
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки ведомости'
      console.error('[useStatementData] Ошибка:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Перезагружает данные
   */
  const reload = () => {
    loadData()
  }

  // Автоматическая загрузка при инициализации
  loadData()

  return {
    // Состояния
    loading,
    error,
    statements,
    
    // Методы
    reload
  }
}