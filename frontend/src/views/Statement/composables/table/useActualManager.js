/**
 * Менеджер для работы с актуальностью строк ведомости (isActual)
 * Обрабатывает изменение статуса актуальности для всей группы позиций
 */
import { statementService } from '@/services/statement.service'

export function useActualManager(attachmentId, reloadCallback) {
  /**
   * Обработчик изменения статуса актуальности
   * Устанавливает isActual = false для всех строк с указанным инв.номером
   * (и партией, если она есть)
   * @param {Object} params - параметры обновления
   * @param {string} params.inv - инвентарный номер
   * @param {string} [params.party] - номер партии (опционально)
   * @param {boolean} params.isActual - новое значение актуальности
   * @returns {Promise<void>}
   */
  const handleActualChange = async ({ invNumber, isActual }) => {
    try {
      // Вызываем сервис для обновления статуса актуальности
      await statementService.updateActualStatus(
        attachmentId,
        invNumber,
        isActual
      )
      
      // После успешного обновления перезагружаем данные
      if (reloadCallback && typeof reloadCallback === 'function') {
        reloadCallback()
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