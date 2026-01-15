// composables/filters/filterStorage.js

const STORAGE_KEY_PREFIX = 'statement_filters_'

/**
 * Сохраняет фильтры в localStorage
 */
export function saveFiltersToStorage(attachmentId, filters) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${attachmentId}`
    localStorage.setItem(key, JSON.stringify(filters))
  } catch (error) {
    console.error('Ошибка сохранения фильтров:', error)
  }
}

/**
 * Загружает фильтры из localStorage
 */
export function loadFiltersFromStorage(attachmentId) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${attachmentId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error('Ошибка загрузки фильтров:', error)
    return {}
  }
}

/**
 * Очищает фильтры из localStorage
 */
export function clearFiltersFromStorage(attachmentId) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${attachmentId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Ошибка очистки фильтров:', error)
  }
}