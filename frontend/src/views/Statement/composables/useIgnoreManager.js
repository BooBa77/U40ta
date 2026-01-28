/**
 * Менеджер для работы с игнорированием строк
 * Обрабатывает изменения состояния is_ignore
 */
import { statementService } from '../services/statement.service'

export function useIgnoreManager(attachmentId, reloadCallback) {
  /**
   * Обработчик изменения состояния игнора
   */
  const handleIgnoreChange = async ({ inv, party, is_ignore }) => {
    try {
      await statementService.updateIgnoreStatus(
        attachmentId,
        inv,
        party,
        is_ignore
      )
      // После успеха - релоад
      if (reloadCallback && typeof reloadCallback === 'function') {
        reloadCallback()
      }
    } catch (error) {
      console.error('Ошибка обновления игнора:', error)
    }
  }

  return {
    handleIgnoreChange
  }
}