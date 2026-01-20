<template>
  <div class="flight-mode-toggle">
    <button
      class="flight-mode-button"
      :class="{ 
        active: isFlightMode,
        'flight-mode-online': !isFlightMode,
        'flight-mode-offline': isFlightMode 
      }"
      @click="toggleFlightMode"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
      :aria-label="buttonLabel"
      :title="tooltipText"
      :disabled="isLoading"
    >
      <!-- Иконка самолёта с анимацией в режиме полёта -->
      <span class="flight-icon" :class="{ swaying: isFlightMode && !isLoading }">✈️</span>
      
      <!-- Индикатор статуса (точка в углу) -->
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
import { offlineCache } from '../../../services/OfflineCacheService.js'

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
    ? 'Режим полёта включен (офлайн). Нажмите для выключения' 
    : 'Режим полёта выключен (онлайн). Нажмите для включения'
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
    
    const response = await fetch('/api/offline/data', {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
      }
    })
    
    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || 'Ошибка загрузки данных')
    }
    
    console.log('Данные загружены, начинаем кэширование...')
    console.log('Объектов:', result.data.objects.length)
    console.log('Мест:', result.data.places.length)
    console.log('Ведомостей:', result.data.processed_statements.length)
    console.log('Истории изменений:', result.data.object_changes.length)
    console.log('QR-кодов:', result.data.qr_codes.length)
    
    await offlineCache.cacheAllData(result.data)
    
    console.log('Режим полёта успешно включен')
    
  } catch (error) {
    console.error('Ошибка при включении режима полёта:', error)
    isFlightMode.value = false
    localStorage.setItem(FLIGHT_MODE_KEY, 'false')
    throw error
    
  } finally {
    isLoading.value = false
  }
}

// Выключение режима полёта
async function disableFlightMode() {
  try {
    console.log('Выключаем режим полёта...')
    
    const localChanges = []
    console.log('Локальные изменения временно отключены')
    
    const checkResponse = await fetch('/api/offline/check-switch-to-online', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        localChangesHistory: localChanges || [] 
      })
    })
    
    if (!checkResponse.ok) {
      throw new Error(`Ошибка проверки: ${checkResponse.status}`)
    }
    
    const checkResult = await checkResponse.json()
    console.log('Результат проверки сервера:', checkResult)
    
    if (!checkResult.success) {
      throw new Error(checkResult.message || 'Ошибка проверки перехода')
    }
    
    if (checkResult.needsSync) {
      console.log('Требуется синхронизация изменений')
      const shouldSync = confirm(
        `Обнаружено ${localChanges.length} локальных изменений.\n` +
        'Требуется синхронизация с сервером.\n\n' +
        'Продолжить без синхронизации? (Изменения будут потеряны)'
      )
      
      if (!shouldSync) {
        throw new Error('Пользователь отменил переход (требуется синхронизация)')
      }
    }
    
    if (checkResult.clearCache) {
      console.log('Сервер разрешил очистку кэша, очищаем...')
      await offlineCache.clearAllCache()
    } else {
      console.log('Сервер НЕ разрешил очистку кэша')
      const shouldClear = confirm(
        'Сервер не разрешил очистку кэша.\n' +
        'Очистить кэш вручную?'
      )
      
      if (shouldClear) {
        await offlineCache.clearAllCache()
      }
    }
    
    console.log('Режим полёта выключен')
    
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
      await disableFlightMode()
      isFlightMode.value = false
    } else {
      await enableFlightMode()
      isFlightMode.value = true
    }
    
    localStorage.setItem(FLIGHT_MODE_KEY, JSON.stringify(isFlightMode.value))
    
    window.dispatchEvent(new CustomEvent('flight-mode-changed', {
      detail: { isFlightMode: isFlightMode.value }
    }))
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: FLIGHT_MODE_KEY,
      newValue: JSON.stringify(isFlightMode.value),
      oldValue: JSON.stringify(!isFlightMode.value)
    }))
    
  } catch (error) {
    console.error('Ошибка переключения режима полёта:', error)
    isFlightMode.value = !isFlightMode.value
  }
}
</script>

<style scoped>
.flight-mode-toggle {
  position: relative;
  display: inline-block;
}

/* Основная кнопка */
.flight-mode-button {
  position: relative;
  width: 44px;
  height: 44px;
  border: 3px solid #ccc;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  padding: 0;
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Состояние онлайн (режим выключен) */
.flight-mode-online {
  border-color: #888888; /* Серый для онлайн */
  background-color: #f8fff8;
}

/* Состояние оффлайн (режим включен) */
.flight-mode-offline {
  width: 62px; /* Увеличение на 40% */
  height: 62px; /* Увеличение на 40% */
  border-color: #0088cc; /* Синий для оффлайн */
  background-color: #f0f8ff;
  box-shadow: 0 0 15px rgba(0, 136, 204, 0.4);
}

.flight-mode-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.flight-mode-button.active:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(0, 136, 204, 0.6);
}

.flight-mode-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Иконка самолёта - увеличенная */
.flight-icon {
  font-size: 20px;
  transition: transform 0.3s ease;
  display: block;
}

/* Анимация покачивания в режиме полёта */
.flight-icon.swaying {
  animation: airplane-sway 2s ease-in-out infinite;
}

.flight-mode-button.active .flight-icon {
  font-size: 28px;
  transform: rotate(45deg);
}

/* Индикатор статуса (точка в углу) - увеличен */
.status-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ccc;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.status-indicator.active {
  background-color: #0088cc;
  box-shadow: 0 0 8px rgba(0, 136, 204, 0.8);
}

/* Индикатор загрузки - увеличен */
.loading-indicator {
  position: absolute;
  top: -3px; /* Было -2px */
  left: -3px; /* Было -2px */
  right: -3px; /* Было -2px */
  bottom: -3px; /* Было -2px */
  border: 3px solid transparent; /* Было 2px */
  border-top-color: #0088cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Анимация покачивания самолёта */
@keyframes airplane-sway {
  0%, 100% {
    transform: rotate(45deg) translateX(0) translateY(0);
  }
  25% {
    transform: rotate(45deg) translateX(2px) translateY(-1px);
  }
  50% {
    transform: rotate(45deg) translateX(0) translateY(-2px);
  }
  75% {
    transform: rotate(45deg) translateX(-2px) translateY(-1px);
  }
}

/* Всплывающая подсказка */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 12px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 6px;
  font-size: 14px;
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
  border-width: 6px;
  border-style: solid;
  border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
}

/* Адаптивность для мобильных */
@media (max-width: 768px) {
  .flight-mode-button {
    width: 56px;
    height: 56px;
  }
  
  .flight-icon {
    font-size: 24px;
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
    bottom: 7px;
    right: 7px;
  }
}
</style>