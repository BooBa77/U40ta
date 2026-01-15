// composables/filters/filterConfig.js

/**
 * Конфигурация фильтров по колонкам
 */
export const columnFilterConfig = {
  // Объединённая колонка "Инв. номер + Партия" фильтруется по inv_number
  'inv_party_combined': {
    filterType: 'multiselect',
    filterColumn: 'inv_number', // Реальная колонка для фильтрации
    modalTitle: 'Фильтр по инвентарному номеру',
    getFilterValues: (row) => row.inv_number || row.invNumber || ''
  },
  
  // Колонка "Наименование"
  'buh_name': {
    filterType: 'multiselect',
    filterColumn: 'buh_name',
    modalTitle: 'Фильтр по наименованию',
    getFilterValues: (row) => row.buh_name || row.buhName || ''
  }
  
  // QR, is_ignore, quantity - не фильтруются (отсутствуют в конфиге)
}

/**
 * Проверяет можно ли фильтровать колонку
 */
export function isColumnFilterable(columnId) {
  return columnId in columnFilterConfig
}

/**
 * Получает конфигурацию фильтра для колонки
 */
export function getFilterConfig(columnId) {
  return columnFilterConfig[columnId]
}