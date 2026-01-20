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
import { offlineCache } from '../../../services/OfflineCacheService.js'// '@/services/offline-cache.service.js'

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
    
    // Загружаем ВСЕ данные одним запросом через эндпоинт offline/data
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
    
    // Кэшируем все данные из одного ответа
    await offlineCache.cacheAllData(result.data)
    
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

// Выключение режима полёта с проверкой локальных изменений
async function disableFlightMode() {
  try {
    console.log('Выключаем режим полёта...')
    
    // 1. Получаем локальные изменения из IndexedDB
    //const localChanges = await offlineCache.getLocalChanges()
    //console.log('Найдено локальных изменений:', localChanges.length)
    const localChanges = [] // временно пустой массив
    console.log('Локальные изменения временно отключены')
    
    // 2. Проверяем у сервера, что делать
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
    
    // 3. Если нужна синхронизация
    if (checkResult.needsSync) {
      console.log('Требуется синхронизация изменений')
      // TODO: Здесь будет отправка изменений на сервер
      // await syncChangesToServer(localChanges)
      
      // Пока просто предупреждаем
      const shouldSync = confirm(
        `Обнаружено ${localChanges.length} локальных изменений.\n` +
        'Требуется синхронизация с сервером.\n\n' +
        'Продолжить без синхронизации? (Изменения будут потеряны)'
      )
      
      if (!shouldSync) {
        throw new Error('Пользователь отменил переход (требуется синхронизация)')
      }
    }
    
    // 4. Если сервер разрешает очистку кэша
    if (checkResult.clearCache) {
      console.log('Сервер разрешил очистку кэша, очищаем...')
      await offlineCache.clearAllCache()
    } else {
      console.log('Сервер НЕ разрешил очистку кэша')
      // Можно спросить у пользователя
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