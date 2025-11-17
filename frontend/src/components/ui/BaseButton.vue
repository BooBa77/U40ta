<template>
  <button 
    class="base-btn" 
    :class="[variant, size, { disabled: disabled }]"
    :disabled="disabled"
    @click="handleClick"
  >
    <span class="btn-content">
      <slot></slot>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'success', 'danger', 'ghost'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.base-btn {
  /* Базовые стили */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width) solid transparent;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition);
  box-shadow: var(--shadow-sm);
  outline: none;
  position: relative;
  overflow: hidden;
  
  /* Убираем стандартные стили браузера */
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.base-btn:focus {
  box-shadow: var(--shadow-sm), 0 0 0 2px var(--color-secondary);
}

.base-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.base-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

/* Размеры */
.small {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 12px;
  min-height: 32px;
}

.medium {
  padding: var(--spacing-sm) var(--spacing);
  font-size: 14px;
  min-height: 40px;
}

.large {
  padding: var(--spacing) var(--spacing-lg);
  font-size: 16px;
  min-height: 48px;
}

/* Варианты */
.primary {
  background-color: var(--color-primary);
  color: white;
}

.primary:hover {
  background-color: #0077b3;
}

.secondary {
  background-color: var(--color-secondary);
  color: #2c3e50;
  border-color: var(--color-secondary);
}

.secondary:hover {
  background-color: #95d4f5;
  border-color: #95d4f5;
}

.success {
  background-color: var(--color-success);
  color: white;
}

.success:hover {
  background-color: #218838;
}

.danger {
  background-color: var(--color-danger);
  color: white;
}

.danger:hover {
  background-color: #c82333;
}

.ghost {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.ghost:hover {
  background-color: var(--color-primary);
  color: white;
}

/* Состояния */
.disabled,
.base-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.disabled:hover,
.base-btn:disabled:hover {
  transform: none !important;
}

/* Loading state */
.base-btn.loading {
  pointer-events: none;
  color: transparent;
}

.base-btn.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Контент кнопки */
.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
}
</style>