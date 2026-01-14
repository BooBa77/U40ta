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
    const haveObject = row.have_object ?? row.haveObject
    const isExcess = row.is_excess ?? row.isExcess
    const isIgnore = row.is_ignore ?? row.isIgnore
    
    if (haveObject === false) return 1
    if (isExcess === true) return 2
    if (haveObject === true) return 3
    if (isIgnore === true) return 4
    
    return 3
  }
  /**
   * Сортирует statements по группам и наименованию
   * @param {Array} statements - массив строк ведомости
   * @returns {Array} отсортированный массив
   */
  const sortStatements = (statements) => {
    return [...statements].sort((a, b) => {
      const groupA = getRowGroup(a)
      const groupB = getRowGroup(b)
      
      if (groupA !== groupB) {
        return groupA - groupB
      }
      
      const nameA = (a.buh_name ?? a.buhName ?? '').toLowerCase()
      const nameB = (b.buh_name ?? b.buhName ?? '').toLowerCase()
      
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB)
      }
      
      const invA = (a.inv_number ?? a.invNumber ?? '').toLowerCase()
      const invB = (b.inv_number ?? b.invNumber ?? '').toLowerCase()
      const partyA = (a.party_number ?? a.partyNumber ?? '').toLowerCase()
      const partyB = (b.party_number ?? b.partyNumber ?? '').toLowerCase()
      
      if (invA !== invB) {
        return invA.localeCompare(invB)
      }
      
      return partyA.localeCompare(partyB)
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