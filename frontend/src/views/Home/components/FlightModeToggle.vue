<template>
  <div class="flight-mode-toggle">
    <button
      class="flight-mode-button"
      :class="{ active: isFlightMode }"
      @click="toggleFlightMode"
      :aria-label="buttonLabel"
      :title="tooltipText"
    >
      <span class="flight-icon">✈️</span>
      <span class="status-indicator" :class="{ active: isFlightMode }"></span>
    </button>
    
    <!-- Всплывающая подсказка при наведении -->
    <div class="tooltip" v-if="showTooltip">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Ключ для localStorage
const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

// Реактивное состояние
const isFlightMode = ref(false)

// Показывать ли тултип (по наведению)
const showTooltip = ref(false)

// Загружаем состояние из localStorage при монтировании
onMounted(() => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY)
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved)
  }
})

// Текст для тултипа и aria-label
const tooltipText = computed(() => {
  return isFlightMode.value 
    ? 'Режим полёта включён (офлайн)' 
    : 'Режим полёта выключен (онлайн)'
})

const buttonLabel = computed(() => {
  return isFlightMode.value ? 'Выключить режим полёта' : 'Включить режим полёта'
})

// Переключение режима
const toggleFlightMode = () => {
  isFlightMode.value = !isFlightMode.value
  localStorage.setItem(FLIGHT_MODE_KEY, JSON.stringify(isFlightMode.value))
  
  // TODO: Здесь позже будет вызов функций кэширования/синхронизации
  console.log(`Режим полёта: ${isFlightMode.value ? 'ВКЛ' : 'ВЫКЛ'}`)
  
  // Можно добавить событие для других компонентов
  window.dispatchEvent(new CustomEvent('flight-mode-changed', {
    detail: { isFlightMode: isFlightMode.value }
  }))
}

// Функции для управления тултипом (можно привязать к событиям мыши)
const showTooltipHandler = () => showTooltip.value = true
const hideTooltipHandler = () => showTooltip.value = false
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

.flight-mode-button:hover {
  border-color: #0088cc;
  transform: scale(1.05);
}

.flight-mode-button.active {
  border-color: #0088cc;
  background-color: #f0f8ff;
  box-shadow: 0 0 10px rgba(0, 136, 204, 0.3);
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

/* Всплывающая подсказка */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.8);
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
  border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
}
</style>