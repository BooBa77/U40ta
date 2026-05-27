/**
 * Менеджер для работы с актуальностью строк инвентаризационной книги (isActual)
 * Обрабатывает изменение статуса актуальности для всей группы позиций с одинаковым invNumber
 * 
 * @param {number} bookId - ID инвентаризационной книги
 * @param {Function} reloadCallback - функция перезагрузки данных после обновления
 * @returns {Object} Методы для управления актуальностью
 */
import { inventoryBookService } from '@/services/inventory-book.service'

export function useActualManager(bookId, reloadCallback) {
  /**
   * Обработчик изменения статуса актуальности
   * Устанавливает isActual для всех строк с указанным инвентарным номером в книге
   * (партия не учитывается — обновляются все строки с данным invNumber)
   * 
   * @param {Object} params - параметры обновления
   * @param {string} params.invNumber - инвентарный номер
   * @param {boolean} params.isActual - новое значение актуальности
   * @returns {Promise<void>}
   */
  const handleActualChange = async ({ invNumber, isActual }) => {
    try {
      // Вызываем сервис для обновления статуса актуальности
      await inventoryBookService.updateActualStatus(
        bookId,
        invNumber,
        isActual
      )
      
      // После успешного обновления перезагружаем данные
      if (reloadCallback && typeof reloadCallback === 'function') {
        await reloadCallback()
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