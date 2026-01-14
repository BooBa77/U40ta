/**
 * Хук для загрузки данных ведомости
 * Версия 2: с сортировкой по группам
 * @param {string|number} attachmentId - ID вложения email
 * @returns {Object} Состояния и методы для работы с данными ведомости
 */
import { ref } from 'vue'
import { statementService } from '../services/statement.service'

export function useStatementData(attachmentId) {
  // Состояния
  const loading = ref(true)
  const error = ref(null)
  const statements = ref([]) // УЖЕ отсортированные данные

  /**
   * Определяет группу строки для сортировки и окраски
   * @param {Object} row - строка ведомости
   * @returns {number} номер группы (1-4)
   */
  const getRowGroup = (row) => {
    // snake_case из кэша или camelCase из API
    const haveObject = row.have_object ?? row.haveObject
    const isExcess = row.is_excess ?? row.isExcess
    const isIgnore = row.is_ignore ?? row.isIgnore
    
    if (haveObject === false) return 1 // красный
    if (isExcess === true) return 2    // жёлтый
    if (haveObject === true) return 3  // зелёный
    if (isIgnore === true) return 4    // серый
    
    return 3 // по умолчанию зелёный
  }

  /**
   * Сортирует statements по группам и наименованию
   * @param {Array} statements - массив строк ведомости
   * @returns {Array} отсортированный массив
   */
  const sortStatements = (statements) => {
    return [...statements].sort((a, b) => {
      // 1. Сортировка по группе (1-4)
      const groupA = getRowGroup(a)
      const groupB = getRowGroup(b)
      
      if (groupA !== groupB) {
        return groupA - groupB // 1,2,3,4 порядок
      }
      
      // 2. Внутри группы - сортировка по наименованию
      const nameA = (a.buh_name ?? a.buhName ?? '').toLowerCase()
      const nameB = (b.buh_name ?? b.buhName ?? '').toLowerCase()
      
      return nameA.localeCompare(nameB)
    })
  }

  /**
   * Загружает данные ведомости
   */
  const loadData = async () => {
    loading.value = true
    error.value = null

    try {
      const data = await statementService.fetchStatement(attachmentId)
      statements.value = sortStatements(data) // ← сразу сортируем
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
    statements, // отсортированные данные
    
    // Методы
    reload,
    getRowGroup
  }
}