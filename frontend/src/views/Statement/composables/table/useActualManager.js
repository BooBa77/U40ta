/**
 * Менеджер для работы с актуальностью строк ведомости (isActual).
 * Обрабатывает изменение статуса актуальности для всей группы позиций.
 * 
 * @param {string} receivedAt - дата получения ведомости в ISO формате
 * @param {Function} reloadCallback - функция перезагрузки данных
 */
import { statementService } from '@/services/statement.service.js'

export function useActualManager(receivedAt, reloadCallback) {
  /**
   * Обработчик изменения статуса актуальности.
   * Устанавливает isActual для всех строк с указанным инв.номером.
   * Возвращает промис от перезагрузки данных.
   * 
   * @param {Object} params - параметры обновления
   * @param {string} params.invNumber - инвентарный номер
   * @param {boolean} params.isActual - новое значение актуальности
   * @returns {Promise<void>}
   */
  const handleActualChange = async ({ invNumber, isActual }) => {
    try {
      await statementService.updateActualStatus(
        receivedAt,
        invNumber,
        isActual
      )
      
      if (reloadCallback && typeof reloadCallback === 'function') {
        return reloadCallback()
      }
    } catch (error) {
      console.error('[useActualManager] Ошибка обновления актуальности:', error)
      throw error
    }
  }

  return {
    handleActualChange
  }
}