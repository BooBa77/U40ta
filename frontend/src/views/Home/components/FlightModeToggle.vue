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
      <span class="flight-icon" :class="{ swaying: isFlightMode && !isLoading }">🚁</span>
      
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
//import { enableFlightMode as enableFlightModeService, disableFlightMode as disableFlightModeService } from '@/services/offline-cache-service'
import { offlineCache } from '@/services/offline-cache-service'

const FLIGHT_MODE_KEY = 'u40ta_flight_mode'
const isFlightMode = ref(false)
const showTooltip = ref(false)
const isLoading = ref(false)

onMounted(() => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY)
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved)
  }
})

const tooltipText = computed(() => {
  if (isLoading.value) return 'Загрузка данных...'
  return isFlightMode.value 
    ? 'Режим полёта включен (офлайн). Нажмите для выключения' 
    : 'Режим полёта выключен (онлайн). Нажмите для включения'
})

const buttonLabel = computed(() => {
  return isFlightMode.value ? 'Выключить режим полёта' : 'Включить режим полёта'
})

async function toggleFlightMode() {
  if (isLoading.value) return
  
  isLoading.value = true
  
  try {
    let result
    
    if (isFlightMode.value) {
      result = await offlineCache.disableFlightMode()
    } else {
      result = await offlineCache.enableFlightMode()
    }
    
    if (!result.success) {
      throw new Error(result.error || 'Не удалось переключить режим')
    }
    
    isFlightMode.value = !isFlightMode.value
    localStorage.setItem(FLIGHT_MODE_KEY, JSON.stringify(isFlightMode.value))
    
    window.dispatchEvent(new CustomEvent('flight-mode-changed', {
      detail: { isFlightMode: isFlightMode.value }
    }))
    
  } catch (error) {
    console.error('Ошибка переключения режима полёта:', error)
    alert(error.message || 'Произошла ошибка при переключении режима')
    
  } finally {
    isLoading.value = false
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
  animation: helicopter-sway 2s ease-in-out infinite;
}

.flight-mode-button.active .flight-icon {
  font-size: 28px;
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
@keyframes helicopter-sway {
  0%, 100% {
    transform: translateX(0) translateY(0);
  }
  25% {
    transform: translateX(-1px) translateY(-4px);
  }
  50% {
    transform: translateX(0) translateY(-3px);
  }
  75% {
    transform: translateX(1px) translateY(2px);
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