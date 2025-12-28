<template>
  <div class="flight-mode-toggle">
    <button
      class="flight-mode-button"
      :class="{ active: isFlightMode }"
      @click="toggleFlightMode"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
      :aria-label="buttonLabel"
      :title="tooltipText"
      :disabled="isLoading"
    >
      <span class="flight-icon">✈️</span>
      <span class="status-indicator" :class="{ active: isFlightMode }"></span>
      
      <!-- Индикатор загрузки -->
      <span class="loading-indicator" v-if="isLoading"></span>
    </button>
    
    <!-- Всплывающая подсказка -->
    <div class="tooltip" v-if="showTooltip && !isLoading">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { offlineCache } from '@/services/offline-cache.service'

// Константы
const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

// Состояния
const isFlightMode = ref(false)
const showTooltip = ref(false)
const isLoading = ref(false)

// Загружаем состояние из localStorage при монтировании
onMounted(() => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY)
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved)
  }
})

// Вычисляемые свойства
const tooltipText = computed(() => {
  if (isLoading.value) return 'Загрузка данных...'
  return isFlightMode.value 
    ? 'Режим полёта включен (офлайн)' 
    : 'Режим полёта выключен (онлайн)'
})

const buttonLabel = computed(() => {
  return isFlightMode.value ? 'Выключить режим полёта' : 'Включить режим полёта'
})

// Вспомогательная функция для загрузки данных с сервера
async function fetchWithAuth(url) {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Требуется авторизация')
  }
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!response.ok) {
    throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

// Включение режима полёта (кэширование данных)
async function enableFlightMode() {
  isLoading.value = true
  
  try {
    console.log('Включаем режим полёта...')
    
    // Параллельно загружаем все данные с сервера
    const [objects, places, processed_statements, object_changes, qr_codes] = await Promise.all([
      fetchWithAuth('/api/objects'),
      fetchWithAuth('/api/places'),
      fetchWithAuth('/api/statements'),
      fetchWithAuth('/api/object-changes'),
      fetchWithAuth('/api/qr-codes')
    ])
    
    console.log('Данные загружены, начинаем кэширование...')
    
    // Кэшируем данные
    await offlineCache.cacheAllData({
      objects,
      places,
      processed_statements,
      object_changes,
      qr_codes
    })
    
    console.log('Режим полёта успешно включен')
    
  } catch (error) {
    console.error('Ошибка при включении режима полёта:', error)
    // Откатываем изменения
    isFlightMode.value = false
    localStorage.setItem(FLIGHT_MODE_KEY, 'false')
    throw error
    
  } finally {
    isLoading.value = false
  }
}

// Выключение режима полёта (пока только очистка кэша)
async function disableFlightMode() {
  try {
    console.log('Выключаем режим полёта...')
    
    // TODO: Здесь будет синхронизация изменений
    
    // Очищаем кэш
    await offlineCache.clearAllCache()
    
    console.log('Режим полёта выключен, кэш очищен')
    
  } catch (error) {
    console.error('Ошибка при выключении режима полёта:', error)
    throw error
  }
}

// Основной переключатель
async function toggleFlightMode() {
  if (isLoading.value) return
  
  try {
    if (isFlightMode.value) {
      // Выключаем режим полёта
      await disableFlightMode()
      isFlightMode.value = false
    } else {
      // Включаем режим полёта
      await enableFlightMode()
      isFlightMode.value = true
    }
    
    // Сохраняем состояние
    localStorage.setItem(FLIGHT_MODE_KEY, JSON.stringify(isFlightMode.value))
    
    // Отправляем событие для других компонентов
    window.dispatchEvent(new CustomEvent('flight-mode-changed', {
      detail: { isFlightMode: isFlightMode.value }
    }))
    
    // Также отправляем событие storage для синхронизации между вкладками
    window.dispatchEvent(new StorageEvent('storage', {
      key: FLIGHT_MODE_KEY,
      newValue: JSON.stringify(isFlightMode.value),
      oldValue: JSON.stringify(!isFlightMode.value)
    }))
    
  } catch (error) {
    console.error('Ошибка переключения режима полёта:', error)
    // Восстанавливаем предыдущее состояние кнопки
    isFlightMode.value = !isFlightMode.value
  }
}
</script>

<style scoped>
.flight-mode-toggle {
  position: relative;
  display: inline-block;
}

.flight-mode-button {
  position: relative;
  width: 44px;
  height: 44px;
  border: 2px solid #ccc;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  padding: 0;
  outline: none;
}

.flight-mode-button:hover:not(:disabled) {
  border-color: #0088cc;
  transform: scale(1.05);
}

.flight-mode-button.active {
  border-color: #0088cc;
  background-color: #f0f8ff;
  box-shadow: 0 0 10px rgba(0, 136, 204, 0.3);
}

.flight-mode-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.flight-icon {
  font-size: 20px;
  transition: transform 0.3s ease;
}

.flight-mode-button.active .flight-icon {
  transform: rotate(45deg);
}

/* Индикатор статуса (точка в углу) */
.status-indicator {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ccc;
  transition: background-color 0.3s ease;
}

.status-indicator.active {
  background-color: #0088cc;
}

/* Индикатор загрузки */
.loading-indicator {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid transparent;
  border-top-color: #0088cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Всплывающая подсказка */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
}

.tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
}
</style>